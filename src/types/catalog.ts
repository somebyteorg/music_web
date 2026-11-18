import type { User } from './session'
import type { LyricVersion } from './lyrics'
import type { AudioFile } from './uploads'

export type CatalogType = 'songs' | 'albums' | 'artists' | 'playlists' | 'libraries'
export type Quality = 'standard' | 'high' | 'lossless' | 'hires'
export interface Person {
  id: string
  name: string
  cover_id?: string | null
  image_url?: string | null
}
export interface AlbumPosition {
  id: string
  disc_number: number
  track_number: number
  version: number
}
export interface AlbumRef extends Person {
  release_year?: number | null
  edition?: string
  pivot?: AlbumPosition
}
export interface Entity extends Person {
  entry_id?: string
  available?: boolean
  can_edit_metadata?: boolean
  can_edit_tracks?: boolean
  description: string
  user_id: number
  version: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  todb_id?: string | null
  metadata_updated_at?: string | null
  recording_version?: string
  recording_id?: string
  recording_tracks?: Entity[]
  release_date?: string | null
  release_year?: number | null
  edition?: string
  release_country?: string
  label?: string
  catalog_number?: string
  musicbrainz_id?: string | null
  total_discs?: number | null
  total_tracks?: number | null
  artwork?: { file_id: string; type: ArtworkType }[]
  genre?: string
  artists?: Person[]
  albums?: AlbumRef[]
  library_id?: string
  library?: Person
  is_default?: boolean
  lyrics?: LyricVersion[]
  files?: AudioFile[]
  files_count?: number
  duration?: number | null
  songs_count?: number
  albums_count?: number
  is_favorite?: boolean
  is_public?: boolean
  collaborators?: User[]
  owner?: User
  creator?: User
}
export type ArtworkType = 'cover' | 'back' | 'disc' | 'booklet' | 'other'
export interface AlbumDraft {
  id: string
  name: string
  artist_name: string
  release_year: number | null
  release_date?: string | null
  genre?: string
  artist_credits?: import('@/features/uploads/musicBrainz').MusicBrainzArtistCredit[]
  edition: string
  release_country: string
  label: string
  catalog_number: string
  musicbrainz_id: string | null
  total_discs: number | null
  total_tracks: number | null
  cover_id: string | null
  artwork: { file_id: string; type: ArtworkType }[]
}
export interface AlbumMatch extends Entity {
  recommended: boolean
  conflicts: string[]
}
