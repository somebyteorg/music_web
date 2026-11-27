import { createUuid } from '@/utils/uuid'
import type { AlbumDraft, AlbumMatch } from '@/types/catalog'
import type { UploadPreview } from '@/types/uploads'
import type { UploadTask } from './model'

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
}
export interface BatchEntry {
  row: BatchRow
  task: UploadTask
}
export interface BatchForm {
  artist: string
  version: string
  applyArtist: boolean
  applyVersion: boolean
  libraryId: string
}
export interface AlbumAssets {
  cover_id: string | null
  artwork: AlbumDraft['artwork']
}

export function setAlbumField<K extends keyof BatchAlbum>(
  album: BatchAlbum,
  key: K,
  value: BatchAlbum[K],
) {
  album[key] = value
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
  const { metadata, draft } = task
  const assignment = draft.albumAssignment ? JSON.stringify(draft.albumAssignment) : ''
  if (grouping === 'folder' && folder)
    return JSON.stringify(['folder', task.batchId, folder, assignment])
  if (assignment)
    return JSON.stringify([
      'assigned',
      assignment,
      draft.albumAssignment?.album_id === null ? [task.batchId, folder] : null,
    ])
  if (!metadata.album.trim()) return JSON.stringify(['singles', task.batchId, folder])
  return JSON.stringify([
    metadata.album.trim(),
    metadata.albumArtist?.trim(),
    metadata.year,
    metadata.catalogNumber,
    metadata.releaseCountry,
    metadata.musicbrainzId,
    metadata.album.trim() ? null : [task.batchId, folder],
  ])
}

export function createBatchAlbum(tasks: UploadTask[] = []): BatchAlbum {
  const first = tasks[0]
  const assignment = first?.draft.albumAssignment
  const uniqueArtists = [
    ...new Set(tasks.map((task) => task.metadata.albumArtist || '').filter(Boolean)),
  ]
  const performers = [...new Set(tasks.map((task) => task.metadata.artist).filter(Boolean))]
  const discTotals = new Map<number, number>()
  for (const task of tasks)
    if (task.metadata.trackTotal) discTotals.set(task.metadata.disc, task.metadata.trackTotal)
  const discTotal = first?.metadata.discTotal || null
  const totalTracks =
    discTotal && discTotals.size === discTotal
      ? [...discTotals.values()].reduce((a, b) => a + b, 0)
      : null
  const saved = assignment?.album
  const folders = [...new Set(tasks.map(albumFolder))]
  const tags = new Set(
    tasks.map((task) => {
      const { metadata } = task
      return JSON.stringify([
        metadata.album.trim(),
        metadata.albumArtist?.trim() || '',
        metadata.year || null,
        metadata.catalogNumber || '',
        metadata.musicbrainzId || '',
        metadata.releaseCountry || '',
      ])
    }),
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
    name: saved?.name || first?.metadata.album || '',
    artist_name:
      saved?.artist_name || uniqueArtists[0] || (performers.length === 1 ? performers[0]! : ''),
    release_year: saved?.release_year || first?.metadata.year || null,
    edition: saved?.edition || '',
    release_country: saved?.release_country || first?.metadata.releaseCountry || '',
    label: saved?.label || first?.metadata.label || '',
    catalog_number: saved?.catalog_number || first?.metadata.catalogNumber || '',
    musicbrainz_id: saved?.musicbrainz_id || first?.metadata.musicbrainzId || null,
    total_discs: saved?.total_discs || discTotal,
    total_tracks: saved?.total_tracks || totalTracks,
    cover_id: null,
    artwork: saved?.artwork || assignment?.album_supplement?.artwork || [],
    includeArtwork: first?.draft.organizeDraft?.includeArtwork ?? true,
    excludedPictureIds: first?.draft.organizeDraft?.excludedPictureIds || [],
    replaceCover:
      first?.draft.organizeDraft?.replaceCover ??
      assignment?.album_supplement?.replace_cover ??
      false,
    coverChoice:
      first?.draft.organizeDraft?.coverChoice ??
      saved?.cover_id ??
      assignment?.album_supplement?.cover_id ??
      'auto',
    matches: [],
    loading: false,
    error: '',
    inferredArtist: !uniqueArtists.length,
  }
}
