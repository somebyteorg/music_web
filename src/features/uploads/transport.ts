import { reactive } from 'vue'
import { prepareUpload } from '@/utils/uploadPreparation'
import type { AudioFile } from '@/types/uploads'
import { applyTaskMetadata } from './taskMetadata'
import type { UploadTransfer } from './taskStats'
import { TRANSMIT_STATES, type UploadTask } from './model'
import type { UploadEvent } from './machine'
import { loadTus, type TusUpload } from './tusClient'
import { uploadRepository } from './repository'

/** 队列里用于去重的稳定指纹：路径 + 大小 + 修改时间 */
export function fingerprintOfFile(file: File) {
  return [file.webkitRelativePath || file.name, file.size, file.lastModified].join(':')
}

/** tus 自己的断点续传指纹：按用户 + 会话隔离，避免跨账号串传 */
export function uploadFingerprint(userId: number, task: UploadTask) {
  return `music:${userId}:${task.transfer.sessionId}:${task.fingerprint}`
}

/** 服务端恢复会话时，把 tus_id 还原成可续传的 uploadUrl */
export function resumeUploadUrl(endpoint: string | undefined, tusId: string) {
  if (!endpoint) return undefined
  return `${endpoint.replace(/\/$/, '')}/${tusId.split('/').map(encodeURIComponent).join('/')}`
}

interface UploadRunnerDeps {
  userId(): number | undefined
  chunkSize(): number
  tasks(): UploadTask[]
  file(taskId: string): File | undefined
  apply(task: UploadTask, event: UploadEvent): void
  finish(task: UploadTask, file: AudioFile, reused?: boolean, kind?: 'processed' | 'reused'): void
  isPublishing(taskId: string): boolean
  idle(): void
}

export interface UploadRunner {
  readonly transfers: Map<string, UploadTransfer>
  readonly attempts: number
  busy(taskId: string): boolean
  run(task: UploadTask): Promise<void>
  poll(task: UploadTask): Promise<void>
  pause(task: UploadTask): Promise<void>
  stopActive(): void
}

/** 任务传输层：文件校验 → 查重 → 建会话 → tus 传输 → 轮询解析；状态迁移一律交给状态机 */
export function createUploadRunner(deps: UploadRunnerDeps): UploadRunner {
  const active = new Map<string, TusUpload>()
  const attempts = new Map<string, symbol>()
  const controllers = new Map<string, AbortController>()
  const cancels = new Map<string, () => void>()
  const polling = new Set<string>()
  const transfers = reactive(new Map<string, UploadTransfer>())

  async function run(task: UploadTask) {
    const file = deps.file(task.id)
    const userId = deps.userId()
    if (!file || userId === undefined) return
    const attempt = Symbol('upload-attempt')
    const controller = new AbortController()
    attempts.set(task.id, attempt)
    controllers.set(task.id, controller)
    deps.apply(task, { type: 'started' })
    const assertActive = () => {
      if (controller.signal.aborted || task.state === 'paused' || deps.userId() !== userId)
        throw new DOMException('上传已暂停。', 'AbortError')
    }
    try {
      if (task.transfer.sessionId) {
        const response = await uploadRepository.getSession(
          task.transfer.sessionId,
          controller.signal,
        )
        assertActive()
        const status = response.session.status
        if (['processing', 'publishing', 'complete'].includes(status)) {
          deps.apply(task, {
            type: 'sessionRestored',
            status: status === 'publishing' ? 'publishing' : 'processing',
          })
          if (status === 'complete' && response.file) deps.finish(task, response.file)
          else await poll(task)
          return
        }
        if (status === 'failed') {
          deps.apply(task, {
            type: 'failed',
            stage: 'processing',
            error: response.session.error || '文件处理失败，请重新解析。',
          })
          return
        }
        if (status === 'uploading' && !task.transfer.uploadUrl && response.session.tus_id)
          task.transfer.uploadUrl = resumeUploadUrl(task.transfer.endpoint, response.session.tus_id)
      }
      if (
        !task.transfer.sha256 ||
        (!task.transfer.sessionId && task.kind === 'audio' && !task.transfer.preparedLyrics)
      ) {
        const prepared = await prepareUpload(
          file,
          task.kind === 'audio',
          controller.signal,
          (metadata) => {
            if (!controller.signal.aborted) applyTaskMetadata(task, metadata)
          },
          (progress) => {
            if (!controller.signal.aborted)
              deps.apply(task, { type: 'progress', preparationProgress: progress })
          },
        )
        assertActive()
        deps.apply(task, {
          type: 'prepared',
          sha256: prepared.sha256,
          preparedLyrics: prepared.metadata.preparedLyrics || [],
        })
      }
      if (!task.transfer.sessionId) {
        if (task.state === 'preparing') deps.apply(task, { type: 'prepared' })
        const existing = await uploadRepository.checkDuplicate(
          {
            sha256: task.transfer.sha256!,
            prepared_lyrics: task.transfer.preparedLyrics,
            kind: task.kind,
            file_size: task.size,
            context: task.batchId
              ? { batch_id: task.batchId, relative_path: task.relativePath }
              : undefined,
          },
          controller.signal,
        )
        assertActive()
        const list = deps.tasks()
        const index = list.findIndex((entry) => entry.id === task.id)
        const source = list
          .slice(0, index)
          .find(
            (entry) =>
              entry.transfer.sha256 === task.transfer.sha256 &&
              entry.kind === task.kind &&
              !entry.transfer.file &&
              TRANSMIT_STATES.includes(entry.state),
          )
        if (existing.file || source) {
          deps.apply(task, {
            type: 'checked',
            duplicate: true,
            duplicateOf: source?.id,
            duplicateFile: existing.file || undefined,
          })
          if (task.kind === 'cover' && existing.file)
            deps.finish(task, existing.file, true, 'reused')
          return
        }
        deps.apply(task, { type: 'checked', duplicate: false })
        const response = await uploadRepository.createSession(
          {
            kind: task.kind,
            file_name: task.name,
            file_size: task.size,
            song_id: task.metadata.targetSongId,
            prepared_lyrics: task.transfer.preparedLyrics,
            sha256: task.transfer.sha256!,
            context: task.batchId
              ? { batch_id: task.batchId, relative_path: task.relativePath }
              : undefined,
          },
          controller.signal,
        )
        assertActive()
        delete task.transfer.preparedLyrics
        deps.apply(task, {
          type: 'sessionCreated',
          sessionId: response.session.id,
          token: response.token,
          endpoint: response.endpoint,
        })
      } else {
        deps.apply(task, {
          type: 'sessionCreated',
          sessionId: task.transfer.sessionId,
          token: task.transfer.token,
          endpoint: task.transfer.endpoint,
          uploadUrl: task.transfer.uploadUrl,
        })
      }
      assertActive()
      const { Upload } = await loadTus() // 失败会带着可读原因落到 failed（阶段 = transfer）
      await new Promise<void>((resolve, reject) => {
        cancels.set(task.id, () => reject(new DOMException('上传已暂停。', 'AbortError')))
        const upload = new Upload(file, {
          endpoint: task.transfer.endpoint!,
          uploadUrl: task.transfer.uploadUrl,
          chunkSize: deps.chunkSize(),
          retryDelays: [0, 1000, 3000, 5000, 10000],
          removeFingerprintOnSuccess: true,
          fingerprint: async () => uploadFingerprint(userId, task),
          metadata: { session_id: task.transfer.sessionId!, token: task.transfer.token! },
          onUploadUrlAvailable: () => {
            task.transfer.uploadUrl = upload.url || undefined
          },
          onProgress: (sent, total) => {
            const time = Date.now()
            const previous = transfers.get(task.id)
            const delta = previous ? time - previous.at : 0
            const rate =
              previous && delta > 0 ? (Math.max(0, sent - previous.sent) * 1000) / delta : 0
            transfers.set(task.id, {
              sent,
              at: time,
              speed: previous ? previous.speed * 0.65 + rate * 0.35 : 0,
            })
            const progress = Math.round((sent / total) * 100)
            if (progress !== task.transfer.progress)
              deps.apply(task, { type: 'progress', progress })
          },
          onError: reject,
          onSuccess: () => resolve(),
        })
        active.set(task.id, upload)
        upload.start()
      })
      assertActive()
      deps.apply(task, { type: 'transferred' })
      await poll(task)
    } catch (error) {
      if (task.state !== 'paused' && deps.userId() === userId)
        deps.apply(task, {
          type: 'failed',
          stage: task.errorStage || 'preparation',
          error: error instanceof Error ? error.message : '上传未能完成，请重试。',
        })
    } finally {
      if (attempts.get(task.id) === attempt) {
        attempts.delete(task.id)
        active.delete(task.id)
        controllers.delete(task.id)
        cancels.delete(task.id)
        transfers.delete(task.id)
      }
      deps.idle()
    }
  }

  /** 轮询服务端处理状态；不改变上传/暂停这些本地状态，只跟进解析、入库与失败 */
  async function poll(task: UploadTask) {
    if (!task.transfer.sessionId || polling.has(task.id) || deps.isPublishing(task.id)) return
    const userId = deps.userId()
    if (userId === undefined) return
    polling.add(task.id)
    try {
      const response = await uploadRepository.getSession(task.transfer.sessionId)
      if (deps.userId() !== userId) return
      if (response.session.status === 'complete' && response.file) deps.finish(task, response.file)
      else if (response.session.status === 'failed') {
        deps.apply(task, {
          type: 'failed',
          stage: task.state === 'publishing' ? 'publishing' : 'processing',
          error: response.session.error || '文件处理未完成，可以重试。',
        })
      } else if (response.session.status === 'publishing') {
        deps.apply(task, { type: 'sessionRestored', status: 'publishing' })
      }
    } catch (error) {
      task.error = error instanceof Error ? error.message : '获取处理状态失败，请重试。'
    } finally {
      polling.delete(task.id)
    }
  }

  async function pause(task: UploadTask) {
    if (!TRANSMIT_STATES.includes(task.state)) return
    deps.apply(task, { type: 'paused' })
    controllers.get(task.id)?.abort()
    cancels.get(task.id)?.()
    await active.get(task.id)?.abort()
  }

  function stopActive() {
    for (const controller of controllers.values()) controller.abort()
    for (const cancel of cancels.values()) cancel()
    for (const upload of active.values()) void upload.abort()
    transfers.clear()
  }

  return {
    transfers,
    get attempts() {
      return attempts.size
    },
    busy: (taskId) => attempts.has(taskId),
    run,
    poll,
    pause,
    stopActive,
  }
}
