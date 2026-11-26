import type { AudioFile } from '@/types/uploads'
import type { PreparedLyric } from '@/types/lyrics'
import type { UploadErrorStage, UploadState, UploadTask } from './model'

/**
 * 上传任务状态机（纯函数）。
 *
 * 输入任务快照和事件，返回新的任务快照；不读 store、不碰 tus / 网络 / window。
 * 非法迁移原样返回同一个引用，调用方可以据此跳过副作用。
 *
 * 合法迁移（来源 → 目标）：
 *   started          queued → preparing
 *   prepared         preparing → checking（可携带 sha256 / preparedLyrics）
 *   checked          checking → duplicate（重复）
 *   checked          checking → checking（不重复，清空错误，等 sessionCreated）
 *   checked          publishing → duplicate（复核后仍判定重复，需重新选择）
 *   sessionCreated   preparing | checking | uploading → uploading
 *   progress         preparing → preparing（校验进度）；uploading → uploading（传输进度）
 *   transferred      queued | preparing | checking | uploading | duplicate | ready | paused | failed
 *                    | processing | publishing → processing | publishing
 *   processed        queued | preparing | checking | uploading | processing | publishing | paused | failed
 *                    | ready | duplicate → ready（未入库）/ published（已关联歌曲）
 *   published        ready | publishing | processing | duplicate | published → published
 *   failed           queued | preparing | checking | uploading | processing | ready | failed → failed
 *   failed(入库失败且可重试) publishing → ready（保留 pendingPublish，等待"重试入库"）
 *   paused           queued | preparing | checking | uploading | failed | ready | duplicate → paused
 *   resumed          paused → queued
 *   retried          failed | paused | duplicate → queued
 *   skipped          duplicate → skipped
 *   reset            failed | paused | ready → queued（清空会话、校验和与进度）
 */
export type UploadEvent =
  | { type: 'started' }
  | { type: 'prepared'; sha256?: string; preparedLyrics?: PreparedLyric[] }
  | { type: 'checked'; duplicate: boolean; duplicateOf?: string; duplicateFile?: AudioFile }
  | {
      type: 'sessionCreated'
      sessionId?: string
      token?: string
      endpoint?: string
      uploadUrl?: string
    }
  | { type: 'progress'; progress?: number; preparationProgress?: number }
  | { type: 'transferred'; status?: 'processing' | 'publishing' }
  | { type: 'processed'; reused?: boolean }
  | { type: 'published'; file?: AudioFile; songId?: string; reused?: boolean }
  | { type: 'failed'; stage: UploadErrorStage; error: string; retryable?: boolean }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'retried' }
  | { type: 'skipped' }
  | { type: 'reset' }

const TRANSMITTING: UploadState[] = ['queued', 'preparing', 'checking', 'uploading']

function move(task: UploadTask, state: UploadState, patch: Partial<UploadTask> = {}): UploadTask {
  return { ...task, ...patch, state }
}

function pct(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function reduceTask(task: UploadTask, event: UploadEvent): UploadTask {
  switch (event.type) {
    case 'started':
      if (task.state !== 'queued') return task
      return move(task, 'preparing', {
        progress: 0,
        preparationProgress: 0,
        error: '',
        errorStage: 'preparation',
      })

    case 'prepared':
      if (task.state !== 'preparing') return task
      return move(task, 'checking', {
        ...(event.sha256 ? { sha256: event.sha256 } : {}),
        ...(event.preparedLyrics ? { preparedLyrics: event.preparedLyrics } : {}),
        preparationProgress: 100,
        error: '',
        errorStage: 'preparation',
      })

    case 'checked':
      if (task.state === 'publishing' && event.duplicate) {
        return move(task, 'duplicate', {
          duplicateOf: event.duplicateOf,
          duplicateFile: event.duplicateFile,
          error: '',
          errorStage: undefined,
        })
      }
      if (task.state !== 'checking') return task
      if (!event.duplicate) return move(task, 'checking', { error: '', errorStage: undefined })
      return move(task, 'duplicate', {
        duplicateOf: event.duplicateOf,
        duplicateFile: event.duplicateFile,
        error: '',
        errorStage: undefined,
      })

    case 'sessionCreated':
      if (!['preparing', 'checking', 'uploading'].includes(task.state)) return task
      return move(task, 'uploading', {
        ...(event.sessionId ? { sessionId: event.sessionId } : {}),
        ...(event.token ? { token: event.token } : {}),
        ...(event.endpoint ? { endpoint: event.endpoint } : {}),
        ...(event.uploadUrl ? { uploadUrl: event.uploadUrl } : {}),
        error: '',
        errorStage: 'transfer',
      })

    case 'progress':
      if (task.state === 'preparing' && event.preparationProgress !== undefined)
        return move(task, 'preparing', { preparationProgress: pct(event.preparationProgress) })
      if (task.state === 'uploading' && event.progress !== undefined)
        return move(task, 'uploading', { progress: pct(event.progress) })
      return task

    case 'transferred': {
      const status = event.status ?? 'processing'
      if (
        ![
          ...TRANSMITTING,
          'duplicate',
          'ready',
          'paused',
          'failed',
          'processing',
          'publishing',
        ].includes(task.state)
      )
        return task
      return move(task, status, {
        ...(status === 'processing' ? { progress: 100 } : {}),
        error: '',
        errorStage: status,
      })
    }

    case 'processed': {
      if (
        ![
          ...TRANSMITTING,
          'processing',
          'publishing',
          'paused',
          'failed',
          'ready',
          'duplicate',
        ].includes(task.state)
      )
        return task
      const file = task.file
      if (!file) return task
      return move(task, file.song_id ? 'published' : 'ready', {
        songId: file.song_id || undefined,
        reused: event.reused || task.reused,
        progress: 100,
        error: '',
        errorStage: undefined,
        token: undefined,
        duplicateFile: undefined,
        duplicateOf: undefined,
      })
    }

    case 'published':
      if (!['ready', 'publishing', 'processing', 'duplicate', 'published'].includes(task.state))
        return task
      return move(task, 'published', {
        ...(event.file ? { file: event.file } : {}),
        songId: event.songId ?? task.songId,
        reused: event.reused || task.reused,
        progress: 100,
        error: '',
        errorStage: undefined,
        token: undefined,
        duplicateFile: undefined,
        duplicateOf: undefined,
        pendingPublish: undefined,
      })

    case 'failed':
      if (['published', 'skipped', 'duplicate'].includes(task.state)) return task
      if (task.state === 'publishing' && event.retryable)
        return move(task, 'ready', { error: event.error, errorStage: event.stage })
      return move(task, 'failed', { error: event.error, errorStage: event.stage })

    case 'paused':
      if (![...TRANSMITTING, 'failed', 'ready', 'duplicate'].includes(task.state)) return task
      return move(task, 'paused')

    case 'resumed':
      if (task.state !== 'paused') return task
      return move(task, 'queued', { error: '', errorStage: undefined })

    case 'retried':
      if (!['failed', 'paused', 'duplicate'].includes(task.state)) return task
      return move(task, 'queued', { error: '', errorStage: undefined })

    case 'skipped':
      if (task.state !== 'duplicate') return task
      return move(task, 'skipped', {
        error: '',
        errorStage: undefined,
        duplicateFile: undefined,
        duplicateOf: undefined,
      })

    case 'reset':
      if (!['failed', 'paused', 'ready'].includes(task.state)) return task
      return move(task, 'queued', {
        progress: 0,
        preparationProgress: 0,
        error: '',
        errorStage: undefined,
        sessionId: undefined,
        token: undefined,
        endpoint: undefined,
        uploadUrl: undefined,
        sha256: undefined,
        duplicateFile: undefined,
        duplicateOf: undefined,
      })
  }
}
