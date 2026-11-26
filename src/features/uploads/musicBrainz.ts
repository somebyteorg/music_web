export interface MusicBrainzArtistCredit {
  musicbrainz_id: string | null
  name: string
  credited_name: string
  joinphrase: string
}
export interface MusicBrainzReleaseSummary {
  id: string
  title: string
  artist_name: string
  date: string
  country: string
  track_count: number | null
  status: string
}
export interface MusicBrainzArtwork {
  id: string
  types: string[]
  front: boolean
  back: boolean
  approved: boolean
  preview_url: string
  type: 'cover' | 'back' | 'disc' | 'booklet' | 'other'
}
export interface MusicBrainzReleaseTrack {
  disc: number
  track: number
  title: string
  artist_name: string
  artist_credits?: MusicBrainzArtistCredit[]
  musicbrainz_id?: string | null
  length_ms?: number | null
  isrcs?: string[]
}
export interface MusicBrainzRelease extends MusicBrainzReleaseSummary {
  release_year: number | null
  release_date?: string | null
  release_country: string
  label: string
  catalog_number: string
  total_discs: number | null
  total_tracks: number | null
  genre?: string
  barcode?: string
  formats?: string[]
  artist_credits?: MusicBrainzArtistCredit[]
  tracks: MusicBrainzReleaseTrack[]
  cover_preview_url: string | null
  artworks?: MusicBrainzArtwork[]
}
