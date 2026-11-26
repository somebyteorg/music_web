import type { AudioFile, UploadDraftMetadata } from '@/types/uploads'
import type { UploadTask } from './model'

/** 解析得到的曲目信息落到 metadata，空值不覆盖已有内容 */
export function applyTaskMetadata(task: UploadTask, metadata: UploadDraftMetadata) {
  const next = task.metadata
  next.title = metadata.title || next.title
  next.artist = metadata.artist || next.artist
  next.album = metadata.album || next.album
  next.albumArtist = metadata.albumArtist || next.albumArtist
  next.year = metadata.year || next.year
  next.label = metadata.label || next.label
  next.catalogNumber = metadata.catalogNumber || next.catalogNumber
  next.releaseCountry = metadata.releaseCountry || next.releaseCountry
  next.musicbrainzId = metadata.musicbrainzId || next.musicbrainzId
  next.trackTotal = metadata.trackTotal || next.trackTotal
  next.discTotal = metadata.discTotal || next.discTotal
  next.track = metadata.track || next.track
  next.disc = metadata.disc || next.disc
  next.duration = metadata.duration || next.duration
}

/** 把已入库文件的标签与草稿合并进任务；状态与进度由状态机的 processed / published 事件负责 */
export function applyUploadedFile(task: UploadTask, file: AudioFile) {
  const tags = file.metadata || {}
  applyTaskMetadata(task, {
    title: String(tags.title || ''),
    artist: String(tags.artist || ''),
    album: String(tags.album || ''),
    albumArtist: String(tags.albumartist || ''),
    year: Number(tags.year) || undefined,
    label: Array.isArray(tags.label) ? tags.label.join(' / ') : String(tags.label || ''),
    catalogNumber: Array.isArray(tags.catalognumber)
      ? tags.catalognumber.join(' / ')
      : String(tags.catalognumber || ''),
    releaseCountry: String(tags.releasecountry || ''),
    musicbrainzId: String(tags.musicbrainz_albumid || ''),
    trackTotal: Number((tags.track as { of?: number })?.of) || undefined,
    discTotal: Number((tags.disk as { of?: number })?.of) || undefined,
    track: Number((tags.track as { no?: number })?.no),
    disc: Number((tags.disk as { no?: number })?.no),
    duration: file.duration,
  })
  task.transfer.file = { ...file, metadata: null }
  if (file.upload_draft) {
    const { data, organize } = file.upload_draft
    const { metadata } = task
    task.draft.publicationGroup = data.publication_group
    metadata.title = data.name || metadata.title
    metadata.artist = data.artist_name ?? metadata.artist
    metadata.version = data.recording_version || ''
    metadata.disc = data.disc_number || 1
    metadata.track = data.track_number || 1
    metadata.libraryId = data.library_id
    task.draft.albumAssignment = {
      album: data.album,
      album_id: data.album_id,
      album_supplement: data.album_supplement,
    }
    metadata.album = data.album?.name || metadata.album
    task.draft.organizeDraft = {
      ...organize,
      choice: data.song_id
        ? `track:${data.song_id}`
        : data.recording_song_id
          ? `recording:${data.recording_song_id}`
          : '',
    }
  }
}
