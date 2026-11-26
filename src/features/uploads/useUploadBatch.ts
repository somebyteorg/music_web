import { computed, ref, type UnwrapRef } from 'vue'
import { createUuid } from '@/utils/uuid'
import { catalogApi } from '@/lib/api/catalog'
import { useLibrariesStore } from '@/stores/libraries'
import type { AlbumDraft } from '@/types/catalog'
import { type PublishData } from '@/types/uploads'
import { useUploadsStore } from '@/stores/uploads'
import { type UploadTask, uploadTrackKey } from '@/features/uploads/model'
import { uploadRepository } from './repository'
import { notify, useAction } from '@/composables/useFeedback'
import { useBatchArtwork } from './useBatchArtwork'
import { useUploadTrackNumbers } from './useUploadTrackNumbers'
import {
  type BatchAlbum,
  type BatchGrouping,
  batchGroupKey,
  type BatchRow,
  createBatchAlbum,
  selectedBatchAlbum as selectedAlbum,
} from './batchModel'

export function useUploadBatch(onSaved: () => Promise<void>) {
  const libraries = useLibrariesStore()
  const uploads = useUploadsStore()
  const { busy, run } = useAction()
  const open = ref(false)
  const rows = ref<BatchRow[]>([])
  const albums = ref<BatchAlbum[]>([])
  const grouping = ref<BatchGrouping>('folder')
  const form = ref({
    artist: '',
    version: '',
    applyArtist: false,
    applyVersion: false,
    libraryId: '',
  })
  const entries = computed(() =>
    rows.value.flatMap((row) => {
      const task = uploads.tasks.find((task) => task.id === row.taskId)
      return task ? [{ row, task }] : []
    }),
  )
  const ready = computed(() =>
    entries.value.filter(({ task }) => task.state === 'ready' && task.file),
  )
  const done = computed(() => entries.value.filter(({ task }) => task.state === 'published').length)
  const groupOptions = computed(() =>
    albums.value.map((album) => ({ value: album.key, label: groupTitle(album) })),
  )
  function groupTitle(album: BatchAlbum) {
    return (
      (grouping.value === 'folder' ? album.groupLabel : '') ||
      selectedAlbum(album)?.name ||
      album.name ||
      album.groupLabel ||
      '单曲分组'
    )
  }
  function songArtist(row: BatchRow) {
    const task = uploads.tasks.find((task) => task.id === row.taskId)
    if (task?.state === 'published') return task.artist
    if (row.choice.startsWith('track:')) return row.artist
    if (form.value.applyArtist) return form.value.artist.trim()
    const album = albumFor(row)
    return album.applyArtist ? album.performer.trim() : row.artist
  }
  function songVersion(row: BatchRow) {
    const task = uploads.tasks.find((task) => task.id === row.taskId)
    if (task?.state === 'published') return task.version
    return !row.choice.startsWith('track:') && form.value.applyVersion
      ? form.value.version.trim()
      : row.version
  }
  function albumFor(row: BatchRow) {
    return albums.value.find((a) => a.key === row.albumKey)!
  }
  function groupEntries(album: BatchAlbum) {
    return entries.value.filter(({ row }) => row.albumKey === album.key)
  }
  const { numbering, numberingErrors, numberTracks, canUndoNumbers, undoNumbers } =
    useUploadTrackNumbers(open, albums, entries, busy, songArtist, songVersion)
  const {
    assets,
    coverId,
    pictureId,
    assetsLoading,
    assetsError,
    hydratePictures,
    pickPicture,
    removePicture,
    forgetPicture,
    coverOptions,
    pictures,
  } = useBatchArtwork(entries, albums)
  function albumOptions(album: BatchAlbum) {
    return [
      { value: '', label: '请选择专辑归属' },
      ...album.matches.map((match) => ({
        value: match.id,
        label: `${match.recommended ? '推荐 · ' : ''}${match.name} · ${match.artists?.map((a) => a.name).join(' / ') || '未填写专辑艺人'}${match.release_year || match.release_date ? ` · ${match.release_year || match.release_date?.slice(0, 4)}` : ''}${match.edition ? ` · ${match.edition}` : ''}${match.catalog_number ? ` · ${match.catalog_number}` : ''} · ${match.songs_count || 0} 首`,
      })),
      { value: 'new', label: '新建这张专辑' },
      { value: 'none', label: '不指定专辑，作为单曲整理' },
    ]
  }
  function draft(album: BatchAlbum): AlbumDraft {
    return {
      id: album.id,
      name: album.name.trim(),
      artist_name: album.artist_name.trim(),
      release_year: album.release_year || null,
      edition: album.edition.trim(),
      release_country: album.release_country.trim(),
      label: album.label.trim(),
      catalog_number: album.catalog_number.trim(),
      musicbrainz_id: album.musicbrainz_id || null,
      total_discs: album.total_discs || null,
      total_tracks: album.total_tracks || null,
      ...assets(album),
    }
  }
  async function searchAlbums(album: BatchAlbum, initial = false) {
    if (!album.name.trim() && (!album.selection || ['new', 'none'].includes(album.selection))) {
      if (initial && !album.selection) album.selection = 'none'
      return
    }
    album.loading = true
    album.error = ''
    try {
      const response = await uploadRepository.albumMatches({
        name: album.name,
        artist_name: album.artist_name,
        release_year: album.release_year || null,
        edition: album.edition,
        catalog_number: album.catalog_number,
        release_country: album.release_country,
        label: album.label,
        musicbrainz_id: album.musicbrainz_id || null,
        total_discs: album.total_discs,
        total_tracks: album.total_tracks,
      })
      album.matches = response.items
      if (
        album.selection &&
        !['new', 'none'].includes(album.selection) &&
        !album.matches.some((match) => match.id === album.selection)
      ) {
        const response = await catalogApi.item('albums', album.selection)
        album.matches.push({ ...response.item, recommended: false, conflicts: [] })
      }
      if (initial && !album.selection && !album.needsReview) {
        const matches = album.matches.filter((match) => match.recommended)
        album.selection = matches.length === 1 ? matches[0]!.id : album.matches.length ? '' : 'new'
      }
      await numberTracks(album, false)
    } catch (error) {
      album.error = error instanceof Error ? error.message : '查找专辑失败，请重试。'
    } finally {
      album.loading = false
    }
  }
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
    form.value = { artist: '', version: '', applyArtist: false, applyVersion: false, libraryId: '' }
    const performers = [...new Set(eligible.map((task) => task.artist.trim()).filter(Boolean))]
    if (performers.length === 1) form.value.artist = performers[0]!
    form.value.libraryId = eligible[0]?.libraryId || libraries.defaultId
    void libraries.load().then(() => {
      if (!form.value.libraryId) form.value.libraryId = libraries.defaultId
    })
    rebuildGroups(eligible)
    open.value = true
    void hydratePreviews()
    void hydratePictures()
  }
  function rebuildGroups(tasks: UploadTask[], previous = new Map<string, BatchRow>()) {
    const inheritedArtists = new Map(
      previous.size
        ? entries.value.map(({ row }) => [
            row.taskId,
            albumFor(row).applyArtist && !form.value.applyArtist ? songArtist(row) : row.artist,
          ])
        : [],
    )
    const groups = new Map<string, UploadTask[]>()
    for (const task of tasks) {
      const key = batchGroupKey(task, grouping.value)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(task)
    }
    const previousAlbums = new Map(
      (previous.size ? albums.value : []).map((album) => [
        groupEntries(album)
          .map(({ task }) => task.id)
          .sort()
          .join(','),
        album,
      ]),
    )
    albums.value = []
    rows.value = []
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
      albums.value.push(album)
      rows.value.push(
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
    rows.value.sort(
      (a, b) => a.albumKey.localeCompare(b.albumKey) || a.disc - b.disc || a.track - b.track,
    )
    for (const album of albums.value)
      if (!album.loading && !album.matches.length) void searchAlbums(album, true)
  }
  function regroup(value: BatchGrouping) {
    if (busy.value || done.value || value === grouping.value) return
    const tasks = entries.value.map(({ task }) => task)
    const previous = new Map(rows.value.map((row) => [row.taskId, row]))
    grouping.value = value
    rebuildGroups(tasks, previous)
    void hydratePreviews()
  }
  function addAlbum(name: string) {
    const value = name.trim()
    if (busy.value || !value || value.length > 255) return false
    const album = createBatchAlbum()
    album.name = value
    album.groupLabel = value
    album.selection = 'new'
    albums.value.push(album)
    return true
  }
  function removeEmptyGroup(album: BatchAlbum) {
    if (!busy.value && !groupEntries(album).length)
      albums.value = albums.value.filter((item) => item.key !== album.key)
  }
  function moveRow(row: BatchRow, targetKey: string, renumber = true) {
    const task = uploads.tasks.find((task) => task.id === row.taskId)
    const target = albums.value.find((album) => album.key === targetKey)
    if (busy.value || !target || !task || task.state === 'published' || row.albumKey === targetKey)
      return
    const source = albumFor(row)
    const group =
      groupEntries(target).find(({ task }) => task.publicationGroup)?.task.publicationGroup ||
      createUuid()
    row.albumKey = targetKey
    if (!task.pendingPublish) task.publicationGroup = group
    if (row.choice.startsWith('track:')) choose(task, row, false)
    removeEmptyGroup(source)
    if (renumber) void numberTracks(target, false)
  }
  function moveGroup(album: BatchAlbum) {
    if (busy.value || !album.moveTo || !albums.value.some((item) => item.key === album.moveTo))
      return
    const target = albums.value.find((item) => item.key === album.moveTo)!
    for (const { row } of groupEntries(album)) moveRow(row, album.moveTo, false)
    album.moveTo = ''
    removeEmptyGroup(album)
    void numberTracks(target, false)
  }
  function problems(album: BatchAlbum) {
    if (
      !album.selection ||
      album.selection === 'none' ||
      album.loading ||
      numbering.value.includes(album.key)
    )
      return []
    const albumId = album.selection === 'new' ? album.id : album.selection
    const items = albums.value
      .filter((item) => (item.selection === 'new' ? item.id : item.selection) === albumId)
      .flatMap(groupEntries)
      .filter(({ task }) => task.state !== 'published')
    const seen = new Map<string, string>()
    const warnings: string[] = []
    if (album.replaceCover && selectedAlbum(album) && !assets(album).cover_id)
      warnings.push('请选择替换用的图片，或取消替换已有专辑封面。')
    for (const { row, task } of items) {
      const slot = `${row.disc}:${row.track}`
      const identity = row.choice.startsWith('track:')
        ? row.choice
        : JSON.stringify([
            task.publicationGroup,
            uploadTrackKey({
              album_id: album.selection,
              name: row.title,
              artist_name: songArtist(row),
              recording_version: songVersion(row),
              disc_number: row.disc,
              track_number: row.track,
              recording_song_id: row.choice.startsWith('recording:')
                ? row.choice.slice(10)
                : undefined,
            }),
          ])
      if (seen.has(slot) && seen.get(slot) !== identity && row.albumKey === album.key)
        warnings.push(`第 ${row.disc} 碟第 ${row.track} 首重复，请核对曲序或关联已有曲目。`)
      seen.set(slot, identity)
    }
    return [...new Set(warnings)]
  }
  const valid = computed(
    () =>
      !numbering.value.length &&
      !assetsLoading.value &&
      !assetsError.value &&
      (ready.value.every(({ row }) => row.choice.startsWith('track:')) || !!form.value.libraryId) &&
      ready.value.every(
        ({ row }) =>
          row.choice.startsWith('track:') ||
          (!form.value.applyArtist && !albumFor(row).applyArtist) ||
          !!songArtist(row),
      ) &&
      ready.value.every(
        ({ row }) =>
          !row.searching &&
          row.title.trim() &&
          Number.isInteger(row.disc) &&
          row.disc >= 1 &&
          row.disc <= 999 &&
          Number.isInteger(row.track) &&
          row.track >= 1 &&
          row.track <= 9999 &&
          albumFor(row),
      ) &&
      albums.value
        .filter((album) => groupEntries(album).length)
        .every(
          (album) =>
            !numberingErrors.value[album.key] &&
            album.selection &&
            !album.loading &&
            (album.selection !== 'new' ||
              (album.name.trim() &&
                (!album.release_year ||
                  (Number.isInteger(album.release_year) &&
                    album.release_year >= 1000 &&
                    album.release_year <= 9999)))) &&
            !problems(album).length &&
            (album.selection === 'none' ||
              !pictures(album).some(
                (picture) =>
                  picture.waiting &&
                  (album.includeArtwork ||
                    (album.coverChoice === 'auto' &&
                      picture.type === 'cover' &&
                      !selectedAlbum(album)?.cover_id)),
              )),
        ),
  )
  function assignment(
    album: BatchAlbum,
  ): Pick<PublishData, 'album' | 'album_id' | 'album_supplement'> {
    if (album.selection === 'none') return { album_id: null }
    if (album.selection === 'new') return { album: draft(album) }
    return {
      album_id: album.selection,
      album_supplement: {
        ...draft(album),
        replace_cover: album.replaceCover && !!assets(album).cover_id,
        cover_version: selectedAlbum(album)?.version,
      },
    }
  }
  function drafts() {
    for (const { row, task } of ready.value) {
      task.title = row.title.trim()
      task.artist = songArtist(row).trim()
      task.track = row.track
      task.disc = row.disc
      task.version = songVersion(row).trim()
      const album = albumFor(row)
      const selected = selectedAlbum(album)
      task.album = album.selection === 'none' ? '' : selected?.name || album.name.trim()
      task.albumArtist =
        album.selection === 'none'
          ? ''
          : selected?.artists?.map((a) => a.name).join(' / ') || album.artist_name.trim()
      task.libraryId = form.value.libraryId
      task.albumAssignment = assignment(album)
      task.organizeDraft = {
        choice: row.choice,
        coverChoice:
          album.coverChoice === 'auto' ? assets(album).cover_id || '' : album.coverChoice,
        includeArtwork: album.includeArtwork,
        excludedPictureIds: album.excludedPictureIds,
        replaceCover: album.replaceCover,
        match: row.matches.find((match) => row.choice.endsWith(match.id)),
      }
    }
  }
  async function persistDrafts(items: ReturnType<typeof publishItems>) {
    for (let offset = 0; offset < items.length; offset += 100) {
      await uploadRepository.saveDrafts(
        items.slice(offset, offset + 100).map(({ task, data }) => ({
          file_id: task.file!.id,
          data,
          organize: {
            coverChoice: task.organizeDraft!.coverChoice,
            includeArtwork: task.organizeDraft!.includeArtwork,
            excludedPictureIds: task.organizeDraft!.excludedPictureIds || [],
            replaceCover: task.organizeDraft!.replaceCover || false,
          },
        })),
      )
    }
  }
  async function save() {
    await run(async () => {
      if (!valid.value) throw new Error('请先确认每组专辑归属，并核对歌名、碟号和曲序。')
      drafts()
      await persistDrafts(publishItems())
      open.value = false
      notify('草稿已保存，可稍后继续加入曲库。')
    })
  }
  function publishItems() {
    return ready.value.map(({ row, task }) => ({
      task,
      data: {
        ...assignment(albumFor(row)),
        publication_group: task.publicationGroup,
        library_id: form.value.libraryId,
        disc_number: row.disc,
        track_number: row.track,
        ...(row.choice.startsWith('track:')
          ? { song_id: row.choice.slice(6) }
          : {
              name: task.title,
              artist_name: task.artist,
              recording_version: task.version,
              track_number: task.track,
              disc_number: task.disc,
              ...(row.choice.startsWith('recording:')
                ? { recording_song_id: row.choice.slice(10) }
                : {}),
            }),
      } satisfies PublishData,
    }))
  }
  async function publish() {
    await run(async () => {
      if (!valid.value) throw new Error('请先确认每组专辑归属，并核对歌名、碟号和曲序。')
      drafts()
      const items = publishItems()
      await persistDrafts(items)
      await uploads.publishMany(items)
      open.value = false
      notify(`已将 ${items.length} 份音频按专辑加入曲库。`)
      await onSaved()
    })
  }
  function options(row: BatchRow) {
    return [
      { value: '', label: '新建歌曲' },
      ...row.matches.flatMap((match) => [
        {
          value: `track:${match.id}`,
          label: `关联已有歌曲 · ${match.name} · ${match.artists.map((artist) => artist.name).join(' / ') || '未知歌手'} · ${match.albums.map((album) => album.name).join(' / ') || '单曲'} · ${match.library?.name || '媒体库未标注'}`,
        },
        {
          value: `recording:${match.id}`,
          label: `新建其他版本并关联录音 · ${match.name} · ${match.recording_version || '未标注版本'}`,
        },
      ]),
    ]
  }
  async function changeAlbum(album: BatchAlbum) {
    for (const { row, task } of groupEntries(album)) {
      if (row.choice.startsWith('track:')) choose(task, row, false)
    }
    await numberTracks(album, false)
  }
  async function hydratePreviews() {
    const missing = entries.value.filter(({ task }) => task.file && !task.file.preview)
    for (let offset = 0; offset < missing.length; offset += 100) {
      const batch = missing.slice(offset, offset + 100)
      try {
        const response = await uploadRepository.previewFiles(batch.map(({ task }) => task.file!.id))
        for (const { row, task } of batch) {
          const file = response.files.find((file) => file.id === task.file?.id)
          if (file && task.file) {
            task.file.preview = file.preview
            if (!row.choice) row.matches = file.preview?.matches || []
          }
        }
      } catch {
        notify('部分解析预览暂未载入，可逐首重新查找已有曲目。', true)
      }
    }
  }
  function choose(task: UploadTask, row: BatchRow, renumber = true) {
    const match = row.matches.find((match) => row.choice.endsWith(match.id))
    if (row.choice.startsWith('track:') && match) {
      row.title = match.name
      row.artist = match.artists.map((artist) => artist.name).join(' / ')
      row.version = match.recording_version
      const placement = match.albums.find((album) => album.id === albumFor(row).selection)?.pivot
      if (placement) {
        row.track = placement.track_number
        row.disc = placement.disc_number
      }
    } else if (!row.choice) {
      row.title = task.title
      row.artist = task.artist
      row.version = task.version
      row.track = task.track
      row.disc = task.disc
    }
    if (renumber) void numberTracks(albumFor(row), false)
  }
  async function searchTracks(task: UploadTask, row: BatchRow) {
    row.searching = true
    try {
      const response = await catalogApi.page('songs', { q: row.title, page_size: 20 })
      row.matches = response.items.map((song) => ({
        id: song.id,
        name: song.name,
        recording_id: song.recording_id!,
        recording_version: song.recording_version || '',
        albums: song.albums || [],
        library: song.library,
        artists: song.artists || [],
        duration: song.duration ? Number(song.duration) : null,
        duration_difference: song.duration
          ? Math.abs(task.file!.duration - Number(song.duration))
          : null,
        different_recording:
          !!song.duration &&
          Math.abs(task.file!.duration - Number(song.duration)) >
            Math.max(5, task.file!.duration * 0.02),
      }))
      if (!row.matches.length) notify('没有找到对应歌曲，可以新建歌曲。')
      if (!row.matches.some((match) => row.choice.endsWith(match.id))) {
        row.choice = ''
        choose(task, row)
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : '查找曲目失败，请重试。', true)
    } finally {
      row.searching = false
    }
  }
  async function uploadCover(album: BatchAlbum, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    await run(async () => {
      const image = await uploads.cover(file)
      pickPicture(album, image)
    })
  }
  return {
    open,
    libraries,
    busy,
    rows,
    albums,
    entries,
    ready,
    done,
    valid,
    form,
    show,
    save,
    publish,
    options,
    addAlbum,
    grouping,
    regroup,
    groupTitle,
    songArtist,
    songVersion,
    removeEmptyGroup,
    moveGroup,
    moveRow,
    groupOptions,
    groupEntries,
    numbering,
    numberingErrors,
    numberTracks,
    canUndoNumbers,
    undoNumbers,
    selectedAlbum,
    albumOptions,
    searchAlbums,
    coverId,
    pictureId,
    assetsLoading,
    assetsError,
    hydratePictures,
    pickPicture,
    removePicture,
    forgetPicture,
    coverOptions,
    pictures,
    problems,
    changeAlbum,
    choose,
    searchTracks,
    uploadCover,
  }
}

export type UploadBatch = UnwrapRef<ReturnType<typeof useUploadBatch>>
