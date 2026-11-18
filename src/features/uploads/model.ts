import type { AudioFile, PublishData, UploadOrganization } from '@/types/uploads'
import type { PreparedLyric } from '@/types/lyrics'

export const MAX_UPLOAD_CONCURRENCY = 32
export const UPLOAD_STATES = {
  queued: '排队中',
  preparing: '校验文件',
  checking: '查重中',
  uploading: '上传中',
  paused: '已暂停',
  processing: '解析中',
  publishing: '入库中',
  ready: '待确认',
  duplicate: '发现重复',
  skipped: '已跳过',
  published: '已完成',
  failed: '失败',
}
export type UploadState = keyof typeof UPLOAD_STATES
export const TRANSMIT_STATES: UploadState[] = ['queued', 'preparing', 'checking', 'uploading']
export const ACTIVE_UPLOAD_STATES: UploadState[] = [...TRANSMIT_STATES, 'processing', 'publishing']

export function normalizeUploadConcurrency(value: unknown): number {
  const number = Number(value)
  return Math.min(
    MAX_UPLOAD_CONCURRENCY,
    Math.max(1, Number.isFinite(number) ? Math.trunc(number) : 8),
  )
}
export function isUploadDone(task: UploadTask) {
  return (
    ['published', 'skipped'].includes(task.state) ||
    (task.kind === 'cover' && task.state === 'ready')
  )
}
export interface UploadTask {
  id: string
  fingerprint: string
  name: string
  size: number
  relativePath: string
  batchId?: string
  kind: 'audio' | 'cover'
  state: UploadState
  progress: number
  error: string
  errorStage?: 'preparation' | 'transfer' | 'processing' | 'publishing'
  preparationProgress?: number
  sha256?: string
  preparedLyrics?: PreparedLyric[]
  reused?: boolean
  duplicateOf?: string
  duplicateFile?: AudioFile
  publicationGroup?: string
  pendingPublish?: PublishData
  sessionId?: string
  token?: string
  endpoint?: string
  uploadUrl?: string
  file?: AudioFile
  songId?: string
  targetSongId?: string
  targetSongName?: string
  title: string
  artist: string
  album: string
  libraryId?: string
  albumArtist?: string
  year?: number
  label?: string
  catalogNumber?: string
  releaseCountry?: string
  musicbrainzId?: string
  musicbrainzRecordingId?: string
  artistCredits?: import('./musicBrainz').MusicBrainzArtistCredit[]
  trackTotal?: number
  discTotal?: number
  albumAssignment?: Pick<PublishData, 'album_id' | 'album' | 'album_supplement'>
  organizeDraft?: UploadOrganization
  version: string
  track: number
  disc: number
  duration?: number
}
export function uploadTrackKey(data: PublishData) {
  const album = data.album_id || data.album?.id
  if (!album || data.song_id) return null
  return JSON.stringify([
    data.library_id || '',
    album,
    data.disc_number || 1,
    data.track_number || 1,
    data.name?.trim() || '',
    data.artist_name?.trim() || '',
    data.recording_version?.trim() || '',
    data.recording_song_id || null,
  ])
}
