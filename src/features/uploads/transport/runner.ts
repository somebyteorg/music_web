import { reactive } from 'vue'
import type { AudioFile } from '@/types/uploads'
import type { UploadEvent } from '../machine'
import { TRANSMIT_STATES, type UploadTask } from '../model'
import type { UploadTransfer } from '../taskStats'
import type { TusUpload } from '../tusClient'
import { uploadRepository } from '../repository'
import { prepareSession, restoreSession } from './session'
import { startTusTransfer } from './tus'

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
    const session = {
      task,
      signal: controller.signal,
      assertActive,
      apply: deps.apply,
      finish: deps.finish,
      poll,
    }
    try {
      if (await restoreSession(session)) return
      if (await prepareSession({ ...session, file, tasks: () => deps.tasks() })) return
      assertActive()
      await startTusTransfer({
        file,
        task,
        userId,
        chunkSize: deps.chunkSize(),
        transfers,
        onProgress: (progress) => deps.apply(task, { type: 'progress', progress }),
        onCancel: (cancel) => cancels.set(task.id, cancel),
        onUpload: (upload) => active.set(task.id, upload),
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
