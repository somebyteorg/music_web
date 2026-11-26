import type { ComputedRef, Ref } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { notify } from '@/composables/useFeedback'
import type { AlbumDraft } from '@/types/catalog'
import type { UploadTask } from './model'
import {
  type AlbumAssets,
  type BatchAlbum,
  type BatchEntry,
  type BatchForm,
  type BatchRow,
} from './batchModel'
import { uploadRepository } from './repository'

interface BatchMatchingDeps {
  albums: Ref<BatchAlbum[]>
  entries: ComputedRef<BatchEntry[]>
  form: Ref<BatchForm>
  groupEntries(album: BatchAlbum): BatchEntry[]
  albumFor(row: BatchRow): BatchAlbum
  songArtist(row: BatchRow): string
  songVersion(row: BatchRow): string
  assets(album: BatchAlbum): AlbumAssets
  numberTracks(album: BatchAlbum, restart?: boolean): Promise<void>
}

/** 专辑/曲目匹配：候选专辑、曲目搜索、解析预览与选择联动 */
export function createBatchMatching(deps: BatchMatchingDeps) {
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

  function albumDraft(album: BatchAlbum): AlbumDraft {
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
      ...deps.assets(album),
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
      await deps.numberTracks(album, false)
    } catch (error) {
      album.error = error instanceof Error ? error.message : '查找专辑失败，请重试。'
    } finally {
      album.loading = false
    }
  }

  function rowOptions(row: BatchRow) {
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

  function choose(task: UploadTask, row: BatchRow, renumber = true) {
    const match = row.matches.find((match) => row.choice.endsWith(match.id))
    if (row.choice.startsWith('track:') && match) {
      row.title = match.name
      row.artist = match.artists.map((artist) => artist.name).join(' / ')
      row.version = match.recording_version
      const placement = match.albums.find(
        (album) => album.id === deps.albumFor(row).selection,
      )?.pivot
      if (placement) {
        row.track = placement.track_number
        row.disc = placement.disc_number
      }
    } else if (!row.choice) {
      const { metadata } = task
      row.title = metadata.title
      row.artist = metadata.artist
      row.version = metadata.version
      row.track = metadata.track
      row.disc = metadata.disc
    }
    if (renumber) void deps.numberTracks(deps.albumFor(row), false)
  }

  async function changeAlbum(album: BatchAlbum) {
    for (const { row, task } of deps.groupEntries(album)) {
      if (row.choice.startsWith('track:')) choose(task, row, false)
    }
    await deps.numberTracks(album, false)
  }

  async function hydratePreviews() {
    const missing = deps.entries.value.filter(
      ({ task }) => task.transfer.file && !task.transfer.file.preview,
    )
    for (let offset = 0; offset < missing.length; offset += 100) {
      const batch = missing.slice(offset, offset + 100)
      try {
        const response = await uploadRepository.previewFiles(
          batch.map(({ task }) => task.transfer.file!.id),
        )
        for (const { row, task } of batch) {
          const file = response.files.find((item) => item.id === task.transfer.file?.id)
          if (file && task.transfer.file) {
            task.transfer.file.preview = file.preview
            if (!row.choice) row.matches = file.preview?.matches || []
          }
        }
      } catch {
        notify('部分解析预览暂未载入，可逐首重新查找已有曲目。', true)
      }
    }
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
          ? Math.abs(task.transfer.file!.duration - Number(song.duration))
          : null,
        different_recording:
          !!song.duration &&
          Math.abs(task.transfer.file!.duration - Number(song.duration)) >
            Math.max(5, task.transfer.file!.duration * 0.02),
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

  return {
    albumOptions,
    albumDraft,
    searchAlbums,
    rowOptions,
    choose,
    changeAlbum,
    searchTracks,
    hydratePreviews,
  }
}
