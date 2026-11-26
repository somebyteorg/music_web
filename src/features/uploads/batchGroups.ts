import type { ComputedRef, Ref } from 'vue'
import { createUuid } from '@/utils/uuid'
import { notify } from '@/composables/useFeedback'
import type { UploadTask } from './model'
import {
  type BatchAlbum,
  type BatchEntry,
  type BatchForm,
  type BatchGrouping,
  batchGroupKey,
  type BatchRow,
  createBatchAlbum,
} from './batchModel'

export interface BatchGroupsDeps {
  uploads: { tasks: UploadTask[] }
  libraries: { defaultId: string; load(refresh?: boolean): Promise<void> }
  busy: Ref<boolean>
  open: Ref<boolean>
  rows: Ref<BatchRow[]>
  albums: Ref<BatchAlbum[]>
  grouping: Ref<BatchGrouping>
  form: Ref<BatchForm>
  entries: ComputedRef<BatchEntry[]>
  done: ComputedRef<number>
  groupEntries(album: BatchAlbum): BatchEntry[]
  albumFor(row: BatchRow): BatchAlbum
  songArtist(row: BatchRow): string
  songVersion(row: BatchRow): string
  choose(task: UploadTask, row: BatchRow, renumber?: boolean): void
  numberTracks(album: BatchAlbum, restart?: boolean): Promise<void>
  searchAlbums(album: BatchAlbum, initial?: boolean): Promise<void>
  hydratePreviews(): Promise<void>
  hydratePictures(): void
}

/** 分组、排序与整组移动：负责把待确认音频组织成专辑分组 */
export function createBatchGroups(deps: BatchGroupsDeps) {
  function show(tasks: UploadTask[]) {
    const seen = new Set<string>()
    const eligible = tasks.filter((task) => {
      if (task.state !== 'ready' || task.kind !== 'audio' || !task.file || seen.has(task.file.id))
        return false
      seen.add(task.file.id)
      return true
    })
    if (!eligible.length) {
      notify('请先选择已解析、待确认的音频。', true)
      return
    }
    deps.form.value = {
      artist: '',
      version: '',
      applyArtist: false,
      applyVersion: false,
      libraryId: '',
    }
    const performers = [...new Set(eligible.map((task) => task.artist.trim()).filter(Boolean))]
    if (performers.length === 1) deps.form.value.artist = performers[0]!
    deps.form.value.libraryId = eligible[0]?.libraryId || deps.libraries.defaultId
    void deps.libraries.load().then(() => {
      if (!deps.form.value.libraryId) deps.form.value.libraryId = deps.libraries.defaultId
    })
    rebuildGroups(eligible)
    deps.open.value = true
    void deps.hydratePreviews()
    void deps.hydratePictures()
  }

  function rebuildGroups(tasks: UploadTask[], previous = new Map<string, BatchRow>()) {
    const inheritedArtists = new Map(
      previous.size
        ? deps.entries.value.map(({ row }) => [
            row.taskId,
            deps.albumFor(row).applyArtist && !deps.form.value.applyArtist
              ? deps.songArtist(row)
              : row.artist,
          ])
        : [],
    )
    const groups = new Map<string, UploadTask[]>()
    for (const task of tasks) {
      const key = batchGroupKey(task, deps.grouping.value)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(task)
    }
    const previousAlbums = new Map(
      (previous.size ? deps.albums.value : []).map((album) => [
        deps
          .groupEntries(album)
          .map(({ task }) => task.id)
          .sort()
          .join(','),
        album,
      ]),
    )
    deps.albums.value = []
    deps.rows.value = []
    for (const tasks of groups.values()) {
      const publicationGroup =
        tasks.find((task) => task.publicationGroup)?.publicationGroup || createUuid()
      for (const task of tasks) if (!task.pendingPublish) task.publicationGroup = publicationGroup
      const previousAlbum = previousAlbums.get(
        tasks
          .map((task) => task.id)
          .sort()
          .join(','),
      )
      const album = previousAlbum || createBatchAlbum(tasks)
      deps.albums.value.push(album)
      deps.rows.value.push(
        ...tasks.map((task) => ({
          taskId: task.id,
          title: task.title,
          artist: task.artist,
          version: task.version,
          track: task.track,
          disc: task.disc,
          choice: task.organizeDraft?.choice || '',
          matches: [
            ...(task.file?.preview?.matches || []),
            ...(task.organizeDraft?.match &&
            !task.file?.preview?.matches.some((match) => match.id === task.organizeDraft?.match?.id)
              ? [task.organizeDraft.match]
              : []),
          ],
          ...previous.get(task.id),
          searching: false,
          ...(!previousAlbum && inheritedArtists.has(task.id)
            ? { artist: inheritedArtists.get(task.id)! }
            : {}),
          albumKey: album.key,
        })),
      )
    }
    deps.rows.value.sort(
      (a, b) => a.albumKey.localeCompare(b.albumKey) || a.disc - b.disc || a.track - b.track,
    )
    for (const album of deps.albums.value)
      if (!album.loading && !album.matches.length) void deps.searchAlbums(album, true)
  }

  function regroup(value: BatchGrouping) {
    if (deps.busy.value || deps.done.value || value === deps.grouping.value) return
    const tasks = deps.entries.value.map(({ task }) => task)
    const previous = new Map(deps.rows.value.map((row) => [row.taskId, row]))
    deps.grouping.value = value
    rebuildGroups(tasks, previous)
    void deps.hydratePreviews()
  }

  function addAlbum(name: string) {
    const value = name.trim()
    if (deps.busy.value || !value || value.length > 255) return false
    const album = createBatchAlbum()
    album.name = value
    album.groupLabel = value
    album.selection = 'new'
    deps.albums.value.push(album)
    return true
  }

  function removeEmptyGroup(album: BatchAlbum) {
    if (!deps.busy.value && !deps.groupEntries(album).length)
      deps.albums.value = deps.albums.value.filter((item) => item.key !== album.key)
  }

  function moveRow(row: BatchRow, targetKey: string, renumber = true) {
    const task = deps.uploads.tasks.find((task) => task.id === row.taskId)
    const target = deps.albums.value.find((album) => album.key === targetKey)
    if (
      deps.busy.value ||
      !target ||
      !task ||
      task.state === 'published' ||
      row.albumKey === targetKey
    )
      return
    const source = deps.albumFor(row)
    const group =
      deps.groupEntries(target).find(({ task }) => task.publicationGroup)?.task.publicationGroup ||
      createUuid()
    row.albumKey = targetKey
    if (!task.pendingPublish) task.publicationGroup = group
    if (row.choice.startsWith('track:')) deps.choose(task, row, false)
    removeEmptyGroup(source)
    if (renumber) void deps.numberTracks(target, false)
  }

  function moveGroup(album: BatchAlbum) {
    if (
      deps.busy.value ||
      !album.moveTo ||
      !deps.albums.value.some((item) => item.key === album.moveTo)
    )
      return
    const target = deps.albums.value.find((item) => item.key === album.moveTo)!
    for (const { row } of deps.groupEntries(album)) moveRow(row, album.moveTo, false)
    album.moveTo = ''
    removeEmptyGroup(album)
    void deps.numberTracks(target, false)
  }

  return { show, rebuildGroups, regroup, addAlbum, removeEmptyGroup, moveRow, moveGroup }
}
