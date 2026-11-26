import type { AudioFile, UploadDraftMetadata } from '@/types/uploads'
import type { UploadTask } from './model'

export function applyTaskMetadata(task: UploadTask, metadata: UploadDraftMetadata) {
  task.title = metadata.title || task.title
  task.artist = metadata.artist || task.artist
  task.album = metadata.album || task.album
  task.albumArtist = metadata.albumArtist || task.albumArtist
  task.year = metadata.year || task.year
  task.label = metadata.label || task.label
  task.catalogNumber = metadata.catalogNumber || task.catalogNumber
  task.releaseCountry = metadata.releaseCountry || task.releaseCountry
  task.musicbrainzId = metadata.musicbrainzId || task.musicbrainzId
  task.trackTotal = metadata.trackTotal || task.trackTotal
  task.discTotal = metadata.discTotal || task.discTotal
  task.track = metadata.track || task.track
  task.disc = metadata.disc || task.disc
  task.duration = metadata.duration || task.duration
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
  task.file = { ...file, metadata: null }
  if (file.upload_draft) {
    const { data, organize } = file.upload_draft
    task.publicationGroup = data.publication_group
    task.title = data.name || task.title
    task.artist = data.artist_name ?? task.artist
    task.version = data.recording_version || ''
    task.disc = data.disc_number || 1
    task.track = data.track_number || 1
    task.libraryId = data.library_id
    task.albumAssignment = {
      album: data.album,
      album_id: data.album_id,
      album_supplement: data.album_supplement,
    }
    task.album = data.album?.name || task.album
    task.organizeDraft = {
      ...organize,
      choice: data.song_id
        ? `track:${data.song_id}`
        : data.recording_song_id
          ? `recording:${data.recording_song_id}`
          : '',
    }
  }
}
