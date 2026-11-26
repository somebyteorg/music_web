import { computed, ref, type UnwrapRef } from 'vue'
import api from '@/utils/ky'
import { createUuid } from '@/utils/uuid'
import { useLibrariesStore } from '@/stores/libraries'
import type { AlbumDraft, AlbumMatch, Entity } from '@/types/catalog'
import type { AudioFile } from '@/types/uploads'
import { type PublishData } from '@/types/uploads'
import type { Page } from '@/types/common'
import { useUploadsStore } from '@/stores/uploads'
import { type UploadTask, uploadTrackKey } from '@/features/uploads/model'
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
import type { MusicBrainzRelease, MusicBrainzReleaseSummary } from './musicBrainz'
import type { PublicAlbumPagePreview } from './publicAlbumPage'

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
      release_date: album.release_date || null,
      genre: album.genre || '',
      artist_credits: album.artist_credits || [],
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
      const response = await api
        .post('albums/matches', {
          json: {
            name: album.name,
            artist_name: album.artist_name,
            release_year: album.release_year || null,
            release_date: album.release_date || null,
            genre: album.genre || '',
            artist_credits: album.artist_credits || [],
            edition: album.edition,
            catalog_number: album.catalog_number,
            release_country: album.release_country,
            label: album.label,
            musicbrainz_id: album.musicbrainz_id || null,
            total_discs: album.total_discs,
            total_tracks: album.total_tracks,
          },
        })
        .json<{ items: AlbumMatch[] }>()
      album.matches = response.items
      if (
        album.selection &&
        !['new', 'none'].includes(album.selection) &&
        !album.matches.some((match) => match.id === album.selection)
      ) {
        const response = await api.get(`catalog/albums/${album.selection}`).json<{ item: Entity }>()
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
          musicbrainzId: task.musicbrainzRecordingId || null,
          artistCredits: task.artistCredits || [],
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
    const selected = selectedAlbum(album)
    const supplement = draft(album)
    if (selected) {
      supplement.name = selected.name || supplement.name
      supplement.artist_name =
        selected.artists?.map((artist) => artist.name).join(' / ') || supplement.artist_name
      supplement.release_year = selected.release_year || supplement.release_year
      supplement.release_date = selected.release_date || supplement.release_date
      supplement.genre = selected.genre || supplement.genre
      supplement.edition = selected.edition || supplement.edition
      supplement.release_country = selected.release_country || supplement.release_country
      supplement.label = selected.label || supplement.label
      supplement.catalog_number = selected.catalog_number || supplement.catalog_number
      supplement.musicbrainz_id = selected.musicbrainz_id || supplement.musicbrainz_id
    }
    return {
      album_id: album.selection,
      album_supplement: {
        ...supplement,
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
      await api.put('files/drafts', {
        json: {
          items: items.slice(offset, offset + 100).map(({ task, data }) => ({
            file_id: task.file!.id,
            data,
            organize: {
              coverChoice: task.organizeDraft!.coverChoice,
              includeArtwork: task.organizeDraft!.includeArtwork,
              excludedPictureIds: task.organizeDraft!.excludedPictureIds || [],
              replaceCover: task.organizeDraft!.replaceCover || false,
            },
          })),
        },
      })
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
    return ready.value.map(({ row, task }) => {
      const externalMetadata = {
        musicbrainz_id: row.musicbrainzId || null,
        release_date: albumFor(row).release_date || null,
        genre: albumFor(row).genre || null,
        artist_credits: row.artistCredits || [],
      }
      const data: PublishData = {
        ...assignment(albumFor(row)),
        publication_group: task.publicationGroup,
        library_id: form.value.libraryId,
        disc_number: row.disc,
        track_number: row.track,
        ...(row.choice.startsWith('track:')
          ? { song_id: row.choice.slice(6), ...externalMetadata }
          : {
              name: task.title,
              artist_name: task.artist,
              ...externalMetadata,
              recording_version: task.version,
              track_number: task.track,
              disc_number: task.disc,
              ...(row.choice.startsWith('recording:')
                ? { recording_song_id: row.choice.slice(10) }
                : {}),
            }),
      }
      task.pendingPublish = data
      task.musicbrainzRecordingId = data.musicbrainz_id || undefined
      task.artistCredits = data.artist_credits || []
      return { task, data }
    })
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
        ...(row.musicbrainzId && match.musicbrainz_id === row.musicbrainzId
          ? []
          : [
              {
                value: `recording:${match.id}`,
                label: `新建其他版本并关联录音 · ${match.name} · ${match.recording_version || '未标注版本'}`,
              },
            ]),
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
        const response = await api
          .post('files/preview', { json: { ids: batch.map(({ task }) => task.file!.id) } })
          .json<{ files: AudioFile[] }>()
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
  function clearSongCredits(row: BatchRow) {
    row.artistCredits = []
  }
  function clearAlbumCredits(album: BatchAlbum) {
    album.artist_credits = []
  }
  async function searchTracks(task: UploadTask, row: BatchRow) {
    row.searching = true
    try {
      let response: Page<Entity> | undefined
      let exactMatch: Entity | undefined
      if (row.musicbrainzId) {
        const exact = await api
          .get('catalog/songs', {
            searchParams: { musicbrainz_id: row.musicbrainzId, page_size: 20 },
          })
          .json<Page<Entity>>()
        if (exact.items.length === 1) {
          response = exact
          exactMatch = exact.items[0]
        }
      }
      response ||= await api
        .get('catalog/songs', { searchParams: { q: row.title, page_size: 20 } })
        .json<Page<Entity>>()
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
      if (exactMatch) row.choice = `track:${exactMatch.id}`
      if (
        !row.matches.some(
          (match) => row.choice === `track:${match.id}` || row.choice === `recording:${match.id}`,
        )
      )
        row.choice = ''
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
  async function searchMusicBrainz(album: BatchAlbum) {
    const query = album.musicBrainzQuery.trim() || album.name.trim()
    if (!query) {
      album.musicBrainzError = '请先输入专辑名称。'
      return
    }
    album.musicBrainzLoading = true
    album.musicBrainzError = ''
    album.musicBrainzPreview = null
    try {
      const response = await api
        .get('metadata/musicbrainz/releases/search', {
          searchParams: { q: query, artist: album.artist_name.trim() },
        })
        .json<{ items: MusicBrainzReleaseSummary[] }>()
      album.musicBrainzResults = response.items
      if (!response.items.length)
        album.musicBrainzError = '没有找到发行版本，请调整名称或歌手后重试。'
    } catch (error) {
      album.musicBrainzError = error instanceof Error ? error.message : '暂时无法搜索 MusicBrainz。'
    } finally {
      album.musicBrainzLoading = false
    }
  }
  async function selectMusicBrainz(album: BatchAlbum, release: MusicBrainzReleaseSummary) {
    album.musicBrainzLoading = true
    album.musicBrainzError = ''
    album.musicBrainzPreview = null
    album.musicBrainzRightsConfirmed = false
    try {
      const response = await api
        .get(`metadata/musicbrainz/releases/${release.id}`)
        .json<{ item: MusicBrainzRelease }>()
      album.musicBrainzPreview = response.item
    } catch (error) {
      album.musicBrainzError = error instanceof Error ? error.message : '无法读取这份发行资料。'
    } finally {
      album.musicBrainzLoading = false
    }
  }
  async function previewPublicAlbum(album: BatchAlbum, mode: 'url' | 'text') {
    const url = album.publicPageUrl.trim()
    const text = album.publicPageText.trim()
    if (mode === 'url' && !url) {
      album.publicPageError = '请先粘贴 QQ 音乐、网易云音乐或酷狗的专辑页链接。'
      return
    }
    if (mode === 'text' && !text) {
      album.publicPageError = '请粘贴专辑页上可见的资料和曲目文字。'
      return
    }

    album.publicPageLoading = true
    album.publicPageError = ''
    album.publicPagePreview = null
    try {
      const response = await api
        .post('metadata/public-album/preview', {
          json: mode === 'url' ? { url } : { url: url || undefined, text },
        })
        .json<{ item: PublicAlbumPagePreview }>()
      album.publicPagePreview = response.item
      if (response.item.read_status === 'unreadable') album.publicPageTextVisible = true
    } catch (error) {
      album.publicPageError = error instanceof Error ? error.message : '暂时无法读取公开专辑资料。'
      if (mode === 'url') album.publicPageTextVisible = true
    } finally {
      album.publicPageLoading = false
    }
  }
  async function applyPublicAlbumPage(album: BatchAlbum) {
    const release = album.publicPagePreview
    if (!release || (!release.title.trim() && !release.tracks.length)) return

    const applies = (key: string) => album.publicPageFields.includes(key)
    if (!album.publicPageFields.length) return
    if (applies('title') && release.title.trim()) album.name = release.title
    if (applies('artist') && release.artist_name.trim()) {
      album.artist_name = release.artist_name
      album.artist_credits = release.artist_credits
    }
    if (applies('year') && release.release_year) album.release_year = release.release_year
    if (applies('date') && release.release_date) album.release_date = release.release_date
    if (applies('genre') && release.genre) album.genre = release.genre
    if (applies('country') && release.release_country)
      album.release_country = release.release_country
    if (applies('label') && release.label) album.label = release.label
    if (applies('catalog') && release.catalog_number) album.catalog_number = release.catalog_number
    album.musicbrainz_id = null
    if (applies('discs') && release.total_discs) album.total_discs = release.total_discs
    if (applies('count') && release.total_tracks) album.total_tracks = release.total_tracks
    album.musicBrainzQuery = album.name

    const normalize = (value: string) =>
      value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '')
    const members = groupEntries(album)
    const tracks = release.tracks
    const titleCounts = new Map<string, number>()
    const rowTitleCounts = new Map<string, number>()
    const positionCounts = new Map<string, number>()
    const trackPositionCounts = new Map<string, number>()
    const byTitle = new Map<string, (typeof tracks)[number]>()
    const byPosition = new Map<string, (typeof tracks)[number]>()
    for (const track of tracks) {
      const key = normalize(track.title)
      titleCounts.set(key, (titleCounts.get(key) || 0) + 1)
      byTitle.set(key, track)
      const position = `${track.disc}:${track.track}`
      byPosition.set(position, track)
      trackPositionCounts.set(position, (trackPositionCounts.get(position) || 0) + 1)
    }
    for (const { row } of members) {
      const key = normalize(row.title)
      rowTitleCounts.set(key, (rowTitleCounts.get(key) || 0) + 1)
      const position = `${row.disc}:${row.track}`
      positionCounts.set(position, (positionCounts.get(position) || 0) + 1)
    }
    const positionsReliable =
      members.length > 0 &&
      members.every(({ row }) => {
        const position = `${row.disc}:${row.track}`
        return positionCounts.get(position) === 1 && trackPositionCounts.get(position) === 1
      })
    let matchedTracks = 0
    const importedRows: { row: BatchRow; task: UploadTask }[] = []
    for (const { row, task } of members) {
      if (task.state === 'published') continue
      const titleKey = normalize(row.title)
      const titleMatch =
        titleKey && titleCounts.get(titleKey) === 1 && rowTitleCounts.get(titleKey) === 1
          ? byTitle.get(titleKey)
          : undefined
      const track =
        titleMatch || (positionsReliable ? byPosition.get(`${row.disc}:${row.track}`) : undefined)
      if (!track) continue
      if (!['trackTitle', 'trackArtist', 'position'].some(applies)) continue
      if (applies('trackTitle')) {
        if (row.title !== track.title) row.musicbrainzId = null
        row.title = track.title
      }
      if (applies('trackArtist')) {
        const artist = track.artist_name || release.artist_name || row.artist
        if (row.artist !== artist) row.musicbrainzId = null
        row.artist = artist
        row.artistCredits = track.artist_credits.length
          ? track.artist_credits
          : release.artist_credits
      }
      if (applies('position')) {
        row.disc = track.disc
        row.track = track.track
      }
      importedRows.push({ row, task })
      matchedTracks++
    }

    if (album.selection === 'new') album.selection = ''
    await Promise.all(importedRows.map(({ row, task }) => searchTracks(task, row)))
    await searchAlbums(album, true)
    notify(
      matchedTracks
        ? `已填入公开页面资料，并按唯一曲名或曲序更新 ${matchedTracks} 首已选音频。`
        : '已填入可用的专辑资料；曲目没有可靠匹配，保留了本地音频原有歌名和曲序。',
    )
  }
  async function applyMusicBrainz(album: BatchAlbum) {
    const release = album.musicBrainzPreview
    if (!release) return
    album.name = release.title
    album.artist_name = release.artist_name
    album.release_year = release.release_year
    album.release_date =
      release.release_date || (/^\d{4}-\d{2}-\d{2}$/.test(release.date) ? release.date : null)
    album.genre = release.genre || ''
    album.artist_credits = release.artist_credits || []
    album.release_country = release.release_country
    album.label = release.label
    album.catalog_number = release.catalog_number
    album.musicbrainz_id = release.id
    album.total_discs = release.total_discs
    album.total_tracks = release.total_tracks
    album.musicBrainzQuery = release.title

    const normalize = (value: string) =>
      value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}]/gu, '')
    const members = groupEntries(album)
    const tracks = release.tracks
    const titleCounts = new Map<string, number>()
    const rowTitleCounts = new Map<string, number>()
    const positionCounts = new Map<string, number>()
    const byTitle = new Map<string, (typeof tracks)[number]>()
    const byPosition = new Map<string, (typeof tracks)[number]>()
    for (const track of tracks) {
      const key = normalize(track.title)
      titleCounts.set(key, (titleCounts.get(key) || 0) + 1)
      byTitle.set(key, track)
      byPosition.set(`${track.disc}:${track.track}`, track)
    }
    for (const { row } of members) {
      const key = normalize(row.title)
      rowTitleCounts.set(key, (rowTitleCounts.get(key) || 0) + 1)
      const position = `${row.disc}:${row.track}`
      positionCounts.set(position, (positionCounts.get(position) || 0) + 1)
    }
    const positionsReliable =
      members.length > 0 &&
      members.every(({ row }) => {
        const position = `${row.disc}:${row.track}`
        return positionCounts.get(position) === 1 && byPosition.has(position)
      })
    let matchedTracks = 0
    const importedRows: { row: BatchRow; task: UploadTask }[] = []
    for (const { row, task } of members) {
      const titleKey = normalize(row.title)
      const titleMatch =
        titleKey && titleCounts.get(titleKey) === 1 && rowTitleCounts.get(titleKey) === 1
          ? byTitle.get(titleKey)
          : undefined
      const track =
        titleMatch || (positionsReliable ? byPosition.get(`${row.disc}:${row.track}`) : undefined)
      if (!track) continue
      row.title = track.title
      row.artist = track.artist_name || release.artist_name
      row.musicbrainzId = track.musicbrainz_id || null
      row.artistCredits = track.artist_credits || release.artist_credits || []
      row.disc = track.disc
      row.track = track.track
      importedRows.push({ row, task })
      matchedTracks++
    }

    if (album.selection === 'new') album.selection = ''
    await Promise.all(importedRows.map(({ row, task }) => searchTracks(task, row)))
    await searchAlbums(album, true)
    notify(
      matchedTracks
        ? `已填入发行资料，并按唯一匹配更新 ${matchedTracks} 首曲目。`
        : '已填入专辑资料；曲目没有可靠匹配，保留了原有歌名和曲序。',
    )
  }
  async function importMusicBrainzCover(album: BatchAlbum) {
    const release = album.musicBrainzPreview
    if (!release?.cover_preview_url) {
      notify('这份发行没有可用的正面封面。', true)
      return
    }
    if (
      !album.musicBrainzRightsConfirmed &&
      !window.confirm(
        '导入此 Cover Art Archive 图片会将图片复制到您的图片库。请仅在您有权使用时继续；导入不会自动替换已有专辑封面。',
      )
    )
      return
    album.musicBrainzRightsConfirmed = true
    album.musicBrainzCoverLoading = true
    try {
      const artwork = release.artworks?.find((item) => item.front && item.preview_url)
      const blob = await api
        .get(`metadata/musicbrainz/releases/${release.id}/cover`, {
          searchParams: artwork ? { image_id: artwork.id } : {},
        })
        .blob()
      const mimeType = blob.type || 'image/jpeg'
      const extension =
        mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
      const filename = release.title.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'album-cover'
      const file = new File([blob], `${filename}.${extension}`, { type: mimeType })
      const image = await uploads.cover(file)
      pickPicture(album, image)
      notify('封面已导入并选中；入库前仍可更换或移除。')
    } catch (error) {
      notify(error instanceof Error ? error.message : '封面导入失败，请重试。', true)
    } finally {
      album.musicBrainzCoverLoading = false
    }
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
    clearSongCredits,
    clearAlbumCredits,
    uploadCover,
    searchMusicBrainz,
    selectMusicBrainz,
    previewPublicAlbum,
    applyPublicAlbumPage,
    applyMusicBrainz,
    importMusicBrainzCover,
  }
}

export type UploadBatch = UnwrapRef<ReturnType<typeof useUploadBatch>>
