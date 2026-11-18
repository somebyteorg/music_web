import type { MusicBrainzArtistCredit } from './musicBrainz'

export interface PublicAlbumPageTrack {
  disc: number
  track: number
  title: string
  artist_name: string
  artist_credits: MusicBrainzArtistCredit[]
  length_ms: number | null
  isrcs: string[]
  platform_id: null
}

export interface PublicAlbumPagePreview {
  title: string
  artist_name: string
  artist_credits: MusicBrainzArtistCredit[]
  release_date: string | null
  release_year: number | null
  release_country: string
  label: string
  catalog_number: string
  genre: string
  total_discs: number | null
  total_tracks: number | null
  barcode: string
  formats: string[]
  description: string
  cover_preview_url: string | null
  tracks: PublicAlbumPageTrack[]
  method: 'public-page' | 'pasted-text'
  source_platform: string
  source_url: string | null
  read_status: 'read' | 'partial' | 'unreadable'
  warning: string | null
}
