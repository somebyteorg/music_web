import { markRaw, reactive, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import {
  createTaskMetadata,
  normalizeUploadConcurrency,
  type TaskMetadata,
  type UploadErrorStage,
  type UploadKind,
  type UploadState,
  type UploadTask,
} from './model'

/**
 * 上传任务的持久化与本地附件。
 *
 * - 任务快照：只落"可恢复字段"——公共标识、状态、续传会话凭据、曲目元数据与错误提示
 * - 不落盘：File / file / duplicateFile / pendingPublish / 歌词 / 进度 / objectURL。
 *   这些要么体积大（歌词）、要么刷新后必然失效（文件记录、待入库数据），
 *   恢复时统一提示"重新选择原文件或原文件夹后，即可继续上传"
 * - 本地附件：File 对象与封面 objectURL 只存在于内存
 */
const STORAGE_KEY = 'music-upload-tasks-v2'

export interface UploadTaskSnapshot {
  id: string
  fingerprint: string
  kind: UploadKind
  state: UploadState
  name: string
  size: number
  relativePath: string
  batchId?: string
  /** 续传会话凭据：解析中的任务靠它继续轮询，传输中的任务靠它断点续传 */
  sessionId?: string
  token?: string
  endpoint?: string
  uploadUrl?: string
  error: string
  errorStage?: UploadErrorStage
  metadata: TaskMetadata
  savedAt: number
}

/** 任务 → 可落盘快照：只挑可恢复字段，其余一律丢掉 */
export function toSnapshot(task: UploadTask): UploadTaskSnapshot {
  const { transfer } = task
  return {
    id: task.id,
    fingerprint: task.fingerprint,
    kind: task.kind,
    state: task.state,
    name: task.name,
    size: task.size,
    relativePath: task.relativePath,
    ...(task.batchId ? { batchId: task.batchId } : {}),
    ...(transfer.sessionId ? { sessionId: transfer.sessionId } : {}),
    ...(transfer.token ? { token: transfer.token } : {}),
    ...(transfer.endpoint ? { endpoint: transfer.endpoint } : {}),
    ...(transfer.uploadUrl ? { uploadUrl: transfer.uploadUrl } : {}),
    error: task.error,
    ...(task.errorStage ? { errorStage: task.errorStage } : {}),
    metadata: { ...task.metadata },
    savedAt: Date.now(),
  }
}

/** 快照 → 任务：文件、待入库数据与进度一律回到初始值，等重新选择文件后重建 */
export function fromSnapshot(snapshot: UploadTaskSnapshot): UploadTask {
  const { sessionId, token, endpoint, uploadUrl } = snapshot
  return {
    id: snapshot.id,
    fingerprint: snapshot.fingerprint,
    kind: snapshot.kind,
    state: snapshot.state,
    name: snapshot.name,
    size: snapshot.size,
    relativePath: snapshot.relativePath,
    ...(snapshot.batchId ? { batchId: snapshot.batchId } : {}),
    error: snapshot.error,
    ...(snapshot.errorStage ? { errorStage: snapshot.errorStage } : {}),
    transfer: {
      progress: 0,
      ...(sessionId ? { sessionId } : {}),
      ...(token ? { token } : {}),
      ...(endpoint ? { endpoint } : {}),
      ...(uploadUrl ? { uploadUrl } : {}),
    },
    metadata: { ...createTaskMetadata(snapshot.name), ...snapshot.metadata },
    draft: {},
  }
}

const EMPTY_TASKS: UploadTask[] = []

export function useUploadPersistence() {
  // 显式拿 localStorage：SSR / 单测里没有 window 时退回纯内存
  const store = typeof localStorage === 'undefined' ? undefined : localStorage
  const saved = useStorage<Record<string, UploadTaskSnapshot[]>>(STORAGE_KEY, {}, store)
  const concurrency = useStorage('music-upload-concurrency', 8, store)
  concurrency.value = normalizeUploadConcurrency(concurrency.value)
  const tasks = reactive<Record<string, UploadTask[]>>({})
  const files = new Map<string, File>()
  const artwork = reactive(new Map<string, string>())
  for (const [key, entries] of Object.entries(saved.value)) tasks[key] = entries.map(fromSnapshot)

  function snapshots() {
    const result: Record<string, UploadTaskSnapshot[]> = {}
    for (const [key, entries] of Object.entries(tasks)) result[key] = entries.map(toSnapshot)
    return result
  }

  // 只有可恢复字段参与快照，进度/文件变化不会触发写盘
  watch(
    () => snapshots(),
    (next) => {
      saved.value = next
    },
    { deep: true },
  )

  function list(userId?: number) {
    return userId === undefined ? EMPTY_TASKS : tasks[String(userId)] || EMPTY_TASKS
  }

  function everyone() {
    return Object.values(tasks)
  }

  function push(userId: number, task: UploadTask) {
    const key = String(userId)
    if (!tasks[key]) tasks[key] = []
    tasks[key].push(task)
  }

  function drop(userId: number | undefined, taskId: string) {
    const entries = userId === undefined ? undefined : tasks[String(userId)]
    const index = entries?.findIndex((entry) => entry.id === taskId) ?? -1
    if (entries && index >= 0) entries.splice(index, 1)
  }

  function attach(task: UploadTask, file: File) {
    files.set(task.id, markRaw(file))
    if (task.kind === 'cover' && !artwork.has(task.id))
      artwork.set(task.id, URL.createObjectURL(file))
  }

  function release(taskId: string) {
    const url = artwork.get(taskId)
    if (url) URL.revokeObjectURL(url)
    artwork.delete(taskId)
  }

  function localCover(task: UploadTask) {
    return artwork.get(task.id) || ''
  }

  return { concurrency, files, list, everyone, push, drop, attach, release, localCover }
}

export type UploadPersistence = ReturnType<typeof useUploadPersistence>
