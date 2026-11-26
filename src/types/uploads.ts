import type { AlbumDraft, AlbumRef, Person, Quality } from './catalog'
import type { EmbeddedLyric, LyricFormat, PreparedLyric } from './lyrics'
import type { User } from './session'

export interface AudioFile {
  id: string
  user_id: number
  song_id: string | null
  kind: 'audio' | 'cover'
  file_name: string
  file_size: number
  mime_type: string
  quality: Quality
  codec: string
  bitrate: number
  sample_rate: number
  bit_depth: number
  channels: number
  duration: number
  is_default: boolean
  metadata: Record<string, unknown> | null
  updated_at: string
  deleted_at: string | null
  uploader?: User
  song?: Person
  preview?: UploadPreview
  upload_context?: UploadContext[] | null
  upload_draft?: UploadDraft | null
}
export interface UploadContext {
  batch_id: string
  relative_path: string
}
export interface UploadOrganization {
  choice: string
  coverChoice: string
  includeArtwork: boolean
  excludedPictureIds?: string[]
  replaceCover?: boolean
  match?: UploadPreview['matches'][number]
}
export interface PublishData {
  publication_group?: string
  song_id?: string
  library_id?: string
  recording_song_id?: string
  name?: string
  artist_name?: string
  album_id?: string | null
  album?: AlbumDraft
  album_supplement?: Omit<AlbumDraft, 'id' | 'name' | 'artist_name'> & {
    replace_cover?: boolean
    cover_version?: number
  }
  recording_version?: string
  track_number?: number
  disc_number?: number
  musicbrainz_id?: string | null
  release_date?: string | null
  genre?: string | null
  artist_credits?: import('@/features/uploads/musicBrainz').MusicBrainzArtistCredit[]
}
export interface UploadDraft {
  data: PublishData
  organize: Omit<UploadOrganization, 'choice' | 'match'>
}
export interface UploadPreview {
  cover_id: string | null
  lyrics: { name: string; language: string; format: LyricFormat }[]
  warnings: string[]
  matches: (Person & {
    musicbrainz_id?: string | null
    recording_id: string
    recording_version: string
    artists: Person[]
    albums: AlbumRef[]
    library?: Person | null
    duration: number | null
    duration_difference: number | null
    different_recording: boolean
  })[]
}
export interface UploadDraftMetadata {
  lyrics?: EmbeddedLyric[]
  preparedLyrics?: PreparedLyric[]
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: number
  label?: string
  catalogNumber?: string
  releaseCountry?: string
  musicbrainzId?: string
  trackTotal?: number
  discTotal?: number
  track?: number
  disc?: number
  duration?: number
}
