import { createUuid } from '@/utils/uuid'
import type { AlbumDraft, AlbumMatch } from '@/types/catalog'
import type { UploadPreview } from '@/types/uploads'
import type { UploadTask } from './model'
import type { MusicBrainzRelease, MusicBrainzReleaseSummary } from './musicBrainz'
import type { PublicAlbumPagePreview } from './publicAlbumPage'

export type BatchGrouping = 'folder' | 'album'

export interface BatchRow {
  taskId: string
  title: string
  artist: string
  version: string
  track: number
  disc: number
  albumKey: string
  choice: string
  matches: UploadPreview['matches']
  searching: boolean
  musicbrainzId?: string | null
  artistCredits?: import('./musicBrainz').MusicBrainzArtistCredit[]
}
export interface BatchAlbum extends AlbumDraft {
  key: string
  groupLabel: string
  needsReview: boolean
  applyArtist: boolean
  performer: string
  moveTo: string
  trackStart: number
  selection: string
  matches: AlbumMatch[]
  loading: boolean
  error: string
  inferredArtist: boolean
  coverChoice: string
  includeArtwork: boolean
  excludedPictureIds: string[]
  replaceCover: boolean
  musicBrainzQuery: string
  musicBrainzResults: MusicBrainzReleaseSummary[]
  musicBrainzPreview: MusicBrainzRelease | null
  musicBrainzLoading: boolean
  musicBrainzCoverLoading: boolean
  musicBrainzRightsConfirmed: boolean
  musicBrainzError: string
  publicPageUrl: string
  publicPageText: string
  publicPageTextVisible: boolean
  publicPagePreview: PublicAlbumPagePreview | null
  publicPageLoading: boolean
  publicPageError: string
}
export interface BatchEntry {
  row: BatchRow
  task: UploadTask
}

export function selectedBatchAlbum(album: BatchAlbum) {
  return album.matches.find((match) => match.id === album.selection)
}

export function uploadFolder(task: UploadTask) {
  const slash = task.relativePath.lastIndexOf('/')
  return slash < 0 ? '' : task.relativePath.slice(0, slash)
}
export function albumFolder(task: UploadTask) {
  return uploadFolder(task).replace(/(?:^|\/)(?:cd|disc|disk|碟)\s*\d+$/i, '')
}

export function batchGroupKey(task: UploadTask, grouping: BatchGrouping) {
  const folder = albumFolder(task)
  const assignment = task.albumAssignment ? JSON.stringify(task.albumAssignment) : ''
  if (grouping === 'folder' && folder)
    return JSON.stringify(['folder', task.batchId, folder, assignment])
  if (assignment)
    return JSON.stringify([
      'assigned',
      assignment,
      task.albumAssignment?.album_id === null ? [task.batchId, folder] : null,
    ])
  if (!task.album.trim()) return JSON.stringify(['singles', task.batchId, folder])
  return JSON.stringify([
    task.album.trim(),
    task.albumArtist?.trim(),
    task.year,
    task.catalogNumber,
    task.releaseCountry,
    task.musicbrainzId,
    task.album.trim() ? null : [task.batchId, folder],
  ])
}

export function createBatchAlbum(tasks: UploadTask[] = []): BatchAlbum {
  const first = tasks[0]
  const assignment = first?.albumAssignment
  const uniqueArtists = [...new Set(tasks.map((task) => task.albumArtist || '').filter(Boolean))]
  const performers = [...new Set(tasks.map((task) => task.artist).filter(Boolean))]
  const discTotals = new Map<number, number>()
  for (const task of tasks) if (task.trackTotal) discTotals.set(task.disc, task.trackTotal)
  const discTotal = first?.discTotal || null
  const totalTracks =
    discTotal && discTotals.size === discTotal
      ? [...discTotals.values()].reduce((a, b) => a + b, 0)
      : null
  const saved = assignment?.album
  const folders = [...new Set(tasks.map(albumFolder))]
  const tags = new Set(
    tasks.map((task) =>
      JSON.stringify([
        task.album.trim(),
        task.albumArtist?.trim() || '',
        task.year || null,
        task.catalogNumber || '',
        task.musicbrainzId || '',
        task.releaseCountry || '',
      ]),
    ),
  )
  return {
    id: saved?.id || createUuid(),
    key: createUuid(),
    groupLabel: folders.length === 1 ? folders[0]?.split('/').pop() || '' : '',
    needsReview: !assignment && tags.size > 1,
    applyArtist: false,
    performer: performers.length === 1 ? performers[0]! : '',
    moveTo: '',
    trackStart: 1,
    selection: assignment ? (assignment.album ? 'new' : assignment.album_id || 'none') : '',
    name: saved?.name || first?.album || '',
    artist_name:
      saved?.artist_name || uniqueArtists[0] || (performers.length === 1 ? performers[0]! : ''),
    release_year: saved?.release_year || first?.year || null,
    release_date:
      saved?.release_date ||
      assignment?.album?.release_date ||
      assignment?.album_supplement?.release_date ||
      null,
    genre: saved?.genre || assignment?.album?.genre || assignment?.album_supplement?.genre || '',
    artist_credits:
      saved?.artist_credits ||
      assignment?.album?.artist_credits ||
      assignment?.album_supplement?.artist_credits ||
      [],
    edition: saved?.edition || '',
    release_country: saved?.release_country || first?.releaseCountry || '',
    label: saved?.label || first?.label || '',
    catalog_number: saved?.catalog_number || first?.catalogNumber || '',
    musicbrainz_id: saved?.musicbrainz_id || first?.musicbrainzId || null,
    total_discs: saved?.total_discs || discTotal,
    total_tracks: saved?.total_tracks || totalTracks,
    cover_id: null,
    artwork: saved?.artwork || assignment?.album_supplement?.artwork || [],
    includeArtwork: first?.organizeDraft?.includeArtwork ?? true,
    excludedPictureIds: first?.organizeDraft?.excludedPictureIds || [],
    replaceCover:
      first?.organizeDraft?.replaceCover ?? assignment?.album_supplement?.replace_cover ?? false,
    musicBrainzQuery: saved?.name || first?.album || '',
    musicBrainzResults: [],
    musicBrainzPreview: null,
    musicBrainzLoading: false,
    musicBrainzCoverLoading: false,
    musicBrainzRightsConfirmed: false,
    musicBrainzError: '',
    publicPageUrl: '',
    publicPageText: '',
    publicPageTextVisible: false,
    publicPagePreview: null,
    publicPageLoading: false,
    publicPageError: '',
    coverChoice:
      first?.organizeDraft?.coverChoice ??
      saved?.cover_id ??
      assignment?.album_supplement?.cover_id ??
      'auto',
    matches: [],
    loading: false,
    error: '',
    inferredArtist: !uniqueArtists.length,
  }
}
