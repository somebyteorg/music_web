import { markRaw, reactive } from 'vue'
import { useStorage } from '@vueuse/core'
import { normalizeUploadConcurrency, type UploadTask } from './model'

/**
 * 上传任务的持久化与本地附件。
 *
 * - 任务快照：沿用 music-upload-tasks-v1，按 userId 隔离；刷新后能恢复任务与错误提示
 * - 本地附件：File 对象与封面 objectURL 只存在于内存，刷新后需要重新选择原文件续传
 */
export function useUploadPersistence() {
  const saved = useStorage<Record<string, UploadTask[]>>('music-upload-tasks-v1', {})
  const concurrency = useStorage('music-upload-concurrency', 8)
  concurrency.value = normalizeUploadConcurrency(concurrency.value)
  const files = new Map<string, File>()
  const artwork = reactive(new Map<string, string>())

  function list(userId?: number) {
    return (userId === undefined ? undefined : saved.value[String(userId)]) || []
  }

  function everyone() {
    return Object.values(saved.value)
  }

  function push(userId: number, task: UploadTask) {
    const key = String(userId)
    if (!saved.value[key]) saved.value[key] = []
    saved.value[key].push(task)
  }

  function drop(userId: number | undefined, taskId: string) {
    const entries = userId === undefined ? undefined : saved.value[String(userId)]
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
