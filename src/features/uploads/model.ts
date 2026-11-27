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

/** 刷新或迁移后任务丢了本地文件时的统一提示：需要用户重新选择原文件 */
export const RESELECT_FILE_HINT = '重新选择原文件或原文件夹后，即可继续上传。'

export function isUploadState(value: unknown): value is UploadState {
  return typeof value === 'string' && Object.hasOwn(UPLOAD_STATES, value)
}

export function normalizeUploadConcurrency(value: unknown): number {
  const number = Number(value)
  return Math.min(
    MAX_UPLOAD_CONCURRENCY,
    Math.max(1, Number.isFinite(number) ? Math.trunc(number) : 8),
  )
}

export type UploadKind = 'audio' | 'cover'
export type UploadErrorStage = 'preparation' | 'transfer' | 'processing' | 'publishing'

/**
 * 传输瞬态：会话凭据、进度与服务端返回的文件记录。
 *
 * 只在内存里成立：`file`、`preparedLyrics` 体积大且会失效，不落盘；
 * 会话凭据是续传与轮询的句柄，持久化时单独挑出来保存。
 */
export interface TaskTransfer {
  /** tus 传输进度（0..100） */
  progress: number
  /** 文件校验进度（0..100） */
  preparationProgress?: number
  sha256?: string
  preparedLyrics?: PreparedLyric[]
  sessionId?: string
  token?: string
  endpoint?: string
  uploadUrl?: string
  /** 服务端返回的文件记录，刷新后失效 */
  file?: AudioFile
  /** 是否复用了已有文件 */
  reused?: boolean
}

/** 曲目元数据：解析结果与整理对话框里可编辑的字段 */
export interface TaskMetadata {
  title: string
  artist: string
  album: string
  albumArtist?: string
  year?: number
  label?: string
  catalogNumber?: string
  releaseCountry?: string
  musicbrainzId?: string
  trackTotal?: number
  discTotal?: number
  track: number
  disc: number
  duration?: number
  version: string
  libraryId?: string
  /** 已入库歌曲 */
  songId?: string
  /** 上传前指定的目标歌曲 */
  targetSongId?: string
  targetSongName?: string
}

/** 整理草稿：待入库数据、专辑归属与重复文件的引用，全部只存在于内存 */
export interface TaskDraft {
  pendingPublish?: PublishData
  publicationGroup?: string
  albumAssignment?: Pick<PublishData, 'album_id' | 'album' | 'album_supplement'>
  organizeDraft?: UploadOrganization
  duplicateOf?: string
  duplicateFile?: AudioFile
}

/**
 * 上传任务：公共标识 + 三个子结构。
 *
 * 字段按"谁维护"分区：transfer 由传输层与状态机写、metadata 由解析与整理写、
 * draft 由状态机（待入库）与整理对话框写。所有状态迁移都经过 machine.ts。
 */
export interface UploadTask {
  id: string
  fingerprint: string
  kind: UploadKind
  state: UploadState
  size: number
  name: string
  relativePath: string
  batchId?: string
  /** 最近一次失败信息，跨阶段共用 */
  error: string
  errorStage?: UploadErrorStage
  transfer: TaskTransfer
  metadata: TaskMetadata
  draft: TaskDraft
}

export function isUploadDone(task: UploadTask) {
  return (
    ['published', 'skipped'].includes(task.state) ||
    (task.kind === 'cover' && task.state === 'ready')
  )
}

interface NewUploadTask {
  id: string
  name: string
  size: number
  relativePath: string
  fingerprint: string
  batchId?: string
  kind: UploadKind
  targetSongId?: string
  targetSongName?: string
  state?: UploadState
}

/** 新任务的初始元数据：歌名取文件名，其余等解析结果覆盖 */
export function createTaskMetadata(name: string): TaskMetadata {
  return {
    title: name.replace(/\.[^.]+$/, ''),
    artist: '',
    album: '',
    version: '',
    track: 1,
    disc: 1,
  }
}

/** 新建任务快照：只有这里决定排队任务的初始形状 */
export function createUploadTask(init: NewUploadTask): UploadTask {
  return {
    id: init.id,
    fingerprint: init.fingerprint,
    kind: init.kind,
    state: init.state ?? 'queued',
    size: init.size,
    name: init.name,
    relativePath: init.relativePath,
    ...(init.batchId ? { batchId: init.batchId } : {}),
    error: '',
    transfer: { progress: 0 },
    metadata: {
      ...createTaskMetadata(init.name),
      ...(init.targetSongId ? { targetSongId: init.targetSongId } : {}),
      ...(init.targetSongName ? { targetSongName: init.targetSongName } : {}),
    },
    draft: {},
  }
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
