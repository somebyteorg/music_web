import type { MusicBrainzArtistCredit } from './musicBrainz'

export const publicAlbumFields = [
  { key: 'title', label: '专辑名称' },
  { key: 'artist', label: '专辑艺人及署名' },
  { key: 'year', label: '发行年份' },
  { key: 'date', label: '发行日期' },
  { key: 'genre', label: '流派' },
  { key: 'country', label: '发行地区' },
  { key: 'label', label: '厂牌' },
  { key: 'catalog', label: '唱片编号' },
  { key: 'discs', label: '碟片总数' },
  { key: 'count', label: '曲目总数' },
  { key: 'trackTitle', label: '匹配曲目的歌名' },
  { key: 'trackArtist', label: '匹配曲目的艺人及署名' },
  { key: 'position', label: '匹配曲目的碟号及曲序' },
]

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
