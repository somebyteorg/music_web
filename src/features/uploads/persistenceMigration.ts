import {
  createTaskMetadata,
  isUploadState,
  RESELECT_FILE_HINT,
  TRANSMIT_STATES,
  type TaskMetadata,
  type UploadErrorStage,
  type UploadKind,
  type UploadState,
} from './model'
import type { UploadTaskSnapshot } from './persistence'

/**
 * 上传任务存储 v1 → v2 迁移。
 *
 * v1（music-upload-tasks-v1）按 userId 存整份 UploadTask，连 file / objectURL /
 * duplicateFile / 整份 draft 一起落盘；v2 只存可恢复字段。这里把 v1 的每条任务
 * 裁剪成 v2 快照：保留标识、状态、尺寸、名称、相对路径、批次、续传会话凭据、
 * 曲目元数据与错误，其余一律丢弃；需要本地文件的状态统一归一成 paused。
 *
 * 迁移只做纯数据转换，不碰 localStorage：先写 v2 再删 v1 的编排留给 persistence.ts。
 */
export const LEGACY_STORAGE_KEY = 'music-upload-tasks-v1'

const TEXT_FIELDS = [
  'title',
  'artist',
  'album',
  'albumArtist',
  'label',
  'catalogNumber',
  'releaseCountry',
  'musicbrainzId',
  'version',
  'libraryId',
  'songId',
  'targetSongId',
  'targetSongName',
] as const
const NUMBER_FIELDS = ['year', 'trackTotal', 'discTotal', 'track', 'disc', 'duration'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isKind(value: unknown): value is UploadKind {
  return value === 'audio' || value === 'cover'
}

function isErrorStage(value: unknown): value is UploadErrorStage {
  return (
    value === 'preparation' ||
    value === 'transfer' ||
    value === 'processing' ||
    value === 'publishing'
  )
}

/** 缺字段或类型不符一律当空串：元数据宁可用文件名兜底，也不让整个任务迁不过去 */
function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function migrateMetadata(value: unknown, name: string): TaskMetadata {
  const base = createTaskMetadata(name)
  if (!isRecord(value)) return base
  const texts: Partial<Record<(typeof TEXT_FIELDS)[number], string>> = {}
  for (const key of TEXT_FIELDS) {
    const entry = value[key]
    if (typeof entry === 'string') texts[key] = entry
  }
  const numbers: Partial<Record<(typeof NUMBER_FIELDS)[number], number>> = {}
  for (const key of NUMBER_FIELDS) {
    const entry = value[key]
    if (isFiniteNumber(entry)) numbers[key] = entry
  }
  return { ...base, ...texts, ...numbers }
}

/** 排队、校验、查重、传输都要本地文件；迁移后文件已不在，统一回落到 paused 等用户重选 */
function restoreState(state: UploadState): { state: UploadState; error: string } {
  if (!TRANSMIT_STATES.includes(state)) return { state, error: '' }
  return { state: 'paused', error: RESELECT_FILE_HINT }
}

function migrateTask(raw: unknown, where: string): UploadTaskSnapshot {
  if (!isRecord(raw)) throw new Error(`${where}不是对象`)
  const { kind, state, size } = raw
  const id = text(raw.id)
  const name = text(raw.name)
  const fingerprint = text(raw.fingerprint)
  const relativePath = text(raw.relativePath)
  if (!id) throw new Error(`${where}缺少 id`)
  if (!name) throw new Error(`${where}缺少文件名`)
  if (!fingerprint) throw new Error(`${where}缺少文件指纹`)
  if (!relativePath) throw new Error(`${where}缺少相对路径`)
  if (!isKind(kind)) throw new Error(`${where}的文件类型无法识别`)
  if (!isUploadState(state)) throw new Error(`${where}的任务状态无法识别`)
  if (!isFiniteNumber(size) || size < 0) throw new Error(`${where}的文件大小无法识别`)
  const transfer = isRecord(raw.transfer) ? raw.transfer : {}
  const batchId = text(raw.batchId)
  const sessionId = text(transfer.sessionId)
  const token = text(transfer.token)
  const endpoint = text(transfer.endpoint)
  const uploadUrl = text(transfer.uploadUrl)
  const restored = restoreState(state)
  const savedAt = isFiniteNumber(raw.savedAt) ? raw.savedAt : Date.now()
  return {
    id,
    fingerprint,
    kind,
    state: restored.state,
    name,
    size,
    relativePath,
    ...(batchId ? { batchId } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(token ? { token } : {}),
    ...(endpoint ? { endpoint } : {}),
    ...(uploadUrl ? { uploadUrl } : {}),
    error: restored.error || text(raw.error),
    ...(isErrorStage(raw.errorStage) ? { errorStage: raw.errorStage } : {}),
    metadata: migrateMetadata(raw.metadata, name),
    savedAt,
  }
}

/**
 * 整份 v1 数据 → v2 快照表。
 *
 * 任何一条任务读不懂都抛错（由调用方保留 v1 并提示），不做「跳过坏数据」的静默丢弃。
 */
export function migrateLegacyTasks(raw: unknown): Record<string, UploadTaskSnapshot[]> {
  if (!isRecord(raw)) throw new Error('旧版数据不是「用户 → 任务列表」的对象')
  const result: Record<string, UploadTaskSnapshot[]> = {}
  for (const [userId, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) throw new Error(`用户 ${userId} 的任务列表不是数组`)
    result[userId] = entries.map((entry, index) =>
      migrateTask(entry, `用户 ${userId} 的第 ${index + 1} 个任务`),
    )
  }
  return result
}
