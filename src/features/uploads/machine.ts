import type { AudioFile, PublishData } from '@/types/uploads'
import type { PreparedLyric } from '@/types/lyrics'
import type {
  TaskDraft,
  TaskMetadata,
  TaskTransfer,
  UploadErrorStage,
  UploadState,
  UploadTask,
} from './model'

/**
 * 上传任务状态机（纯函数）。
 *
 * 输入任务快照和事件，返回新的任务快照；不读 store、不碰 tus / 网络 / window。
 * 非法迁移原样返回同一个引用，调用方可以据此跳过副作用。
 *
 * 合法迁移（来源 → 目标）：
 *   started            queued → preparing
 *   prepared           preparing → checking（可携带 sha256 / preparedLyrics）
 *   checked(true)      checking | publishing → duplicate（复核后仍判定重复）
 *   checked(false)     checking → checking（不重复，清空错误，等 sessionCreated）
 *   sessionCreated     preparing | checking | uploading → uploading
 *   sessionRestored    preparing | checking | processing | publishing | paused | failed | ready
 *                      → processing | publishing（续传时发现服务端已在处理/入库）
 *   publishingStarted  ready | duplicate → publishing（复用已有文件，直接入库）
 *   publishingQueued   ready | duplicate → publishing（写入待入库数据）
 *   publishingDiscarded ready → ready（清空待入库数据，保留在待确认）
 *   progress           preparing → preparing（校验进度）；uploading → uploading（传输进度）
 *   transferred        uploading → processing（服务端返回 publishing 时 → publishing）
 *   processed          processing | publishing → ready（未入库）/ published（已关联歌曲）
 *   reused             duplicate | ready | published → ready / published（直接复用已有文件）
 *   published          ready | publishing | processing | duplicate | published → published
 *   failed             queued | preparing | checking | uploading | processing | ready | failed → failed
 *   failed(入库失败且可重试) publishing → ready（保留 pendingPublish，等待"重试入库"）
 *   paused             queued | preparing | checking | uploading | failed | ready | duplicate → paused
 *   resumed            paused → queued
 *   retried            failed | paused | duplicate → queued
 *   skipped            duplicate → skipped
 *   reset              failed | paused | ready → queued（清空会话、校验和与进度）
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
  | { type: 'sessionRestored'; status?: 'processing' | 'publishing' }
  | { type: 'publishingStarted' }
  | { type: 'publishingQueued'; payload: PublishData }
  | { type: 'publishingDiscarded' }
  | { type: 'progress'; progress?: number; preparationProgress?: number }
  | { type: 'transferred'; status?: 'processing' | 'publishing' }
  | { type: 'processed'; reused?: boolean }
  | { type: 'reused'; reused?: boolean }
  | { type: 'published'; file?: AudioFile; songId?: string; reused?: boolean }
  | {
      type: 'failed'
      stage: UploadErrorStage
      error: string
      retryable?: boolean
      payload?: PublishData
    }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'retried' }
  | { type: 'skipped' }
  | { type: 'reset' }

const TRANSMITTING: UploadState[] = ['queued', 'preparing', 'checking', 'uploading']

type CommonPatch = Partial<Pick<UploadTask, 'error' | 'errorStage'>>

/** 三个子结构各自局部更新，未提到的字段原样保留 */
export interface TaskPatch {
  common?: CommonPatch
  transfer?: Partial<TaskTransfer>
  metadata?: Partial<TaskMetadata>
  draft?: Partial<TaskDraft>
}

function move(task: UploadTask, state: UploadState, patch: TaskPatch = {}): UploadTask {
  return {
    ...task,
    ...patch.common,
    state,
    transfer: { ...task.transfer, ...patch.transfer },
    metadata: { ...task.metadata, ...patch.metadata },
    draft: { ...task.draft, ...patch.draft },
  }
}

function pct(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** processed / reused 共用：按文件是否已关联歌曲落到 ready 或 published */
function complete(task: UploadTask, reused?: boolean) {
  const file = task.transfer.file
  if (!file) return undefined
  return move(task, file.song_id ? 'published' : 'ready', {
    common: { error: '', errorStage: undefined },
    transfer: { progress: 100, token: undefined, reused: reused || task.transfer.reused },
    metadata: { songId: file.song_id || undefined },
    draft: { duplicateFile: undefined, duplicateOf: undefined },
  })
}

export function reduceTask(task: UploadTask, event: UploadEvent): UploadTask {
  switch (event.type) {
    case 'started':
      if (task.state !== 'queued') return task
      return move(task, 'preparing', {
        common: { error: '', errorStage: 'preparation' },
        transfer: { progress: 0, preparationProgress: 0 },
      })

    case 'prepared':
      if (task.state !== 'preparing') return task
      return move(task, 'checking', {
        common: { error: '', errorStage: 'preparation' },
        transfer: {
          ...(event.sha256 ? { sha256: event.sha256 } : {}),
          ...(event.preparedLyrics ? { preparedLyrics: event.preparedLyrics } : {}),
          preparationProgress: 100,
        },
      })

    case 'checked': {
      if (task.state === 'publishing' && event.duplicate)
        return move(task, 'duplicate', {
          common: { error: '', errorStage: undefined },
          draft: { duplicateOf: event.duplicateOf, duplicateFile: event.duplicateFile },
        })
      if (task.state !== 'checking') return task
      if (!event.duplicate)
        return move(task, 'checking', { common: { error: '', errorStage: undefined } })
      return move(task, 'duplicate', {
        common: { error: '', errorStage: undefined },
        draft: { duplicateOf: event.duplicateOf, duplicateFile: event.duplicateFile },
      })
    }

    case 'sessionCreated':
      if (!['preparing', 'checking', 'uploading'].includes(task.state)) return task
      return move(task, 'uploading', {
        common: { error: '', errorStage: 'transfer' },
        transfer: {
          ...(event.sessionId ? { sessionId: event.sessionId } : {}),
          ...(event.token ? { token: event.token } : {}),
          ...(event.endpoint ? { endpoint: event.endpoint } : {}),
          ...(event.uploadUrl ? { uploadUrl: event.uploadUrl } : {}),
        },
      })

    case 'sessionRestored': {
      if (
        ![
          'preparing',
          'checking',
          'processing',
          'publishing',
          'paused',
          'failed',
          'ready',
        ].includes(task.state)
      )
        return task
      const status = event.status ?? 'processing'
      return move(task, status, { common: { error: '', errorStage: status } })
    }

    case 'publishingStarted':
      if (!['ready', 'duplicate'].includes(task.state)) return task
      return move(task, 'publishing', { common: { error: '', errorStage: 'publishing' } })

    case 'publishingQueued':
      if (!['ready', 'duplicate'].includes(task.state)) return task
      return move(task, 'publishing', {
        common: { error: '', errorStage: 'publishing' },
        draft: { pendingPublish: event.payload },
      })

    case 'publishingDiscarded':
      if (task.state !== 'ready') return task
      return move(task, 'ready', {
        common: { error: '', errorStage: undefined },
        draft: { pendingPublish: undefined },
      })

    case 'progress':
      if (task.state === 'preparing' && event.preparationProgress !== undefined)
        return move(task, 'preparing', {
          transfer: { preparationProgress: pct(event.preparationProgress) },
        })
      if (task.state === 'uploading' && event.progress !== undefined)
        return move(task, 'uploading', { transfer: { progress: pct(event.progress) } })
      return task

    case 'transferred': {
      if (task.state !== 'uploading') return task
      const status = event.status ?? 'processing'
      return move(task, status, {
        common: { error: '', errorStage: status },
        ...(status === 'processing' ? { transfer: { progress: 100 } } : {}),
      })
    }

    case 'processed': {
      if (!['processing', 'publishing'].includes(task.state)) return task
      return complete(task, event.reused) ?? task
    }

    case 'reused': {
      if (!['duplicate', 'ready', 'published'].includes(task.state)) return task
      return complete(task, event.reused) ?? task
    }

    case 'published':
      if (!['ready', 'publishing', 'processing', 'duplicate', 'published'].includes(task.state))
        return task
      return move(task, 'published', {
        common: { error: '', errorStage: undefined },
        transfer: {
          ...(event.file ? { file: event.file } : {}),
          progress: 100,
          token: undefined,
          reused: event.reused || task.transfer.reused,
        },
        metadata: { songId: event.songId ?? task.metadata.songId },
        draft: { duplicateFile: undefined, duplicateOf: undefined, pendingPublish: undefined },
      })

    case 'failed': {
      if (['published', 'skipped', 'duplicate'].includes(task.state)) return task
      const patch: TaskPatch = {
        common: { error: event.error, errorStage: event.stage },
        ...(event.payload ? { draft: { pendingPublish: event.payload } } : {}),
      }
      if (task.state === 'publishing' && event.retryable) return move(task, 'ready', patch)
      return move(task, 'failed', patch)
    }

    case 'paused':
      if (![...TRANSMITTING, 'failed', 'ready', 'duplicate'].includes(task.state)) return task
      return move(task, 'paused')

    case 'resumed':
      if (task.state !== 'paused') return task
      return move(task, 'queued', { common: { error: '', errorStage: undefined } })

    case 'retried':
      if (!['failed', 'paused', 'duplicate'].includes(task.state)) return task
      return move(task, 'queued', { common: { error: '', errorStage: undefined } })

    case 'skipped':
      if (task.state !== 'duplicate') return task
      return move(task, 'skipped', {
        common: { error: '', errorStage: undefined },
        draft: { duplicateFile: undefined, duplicateOf: undefined },
      })

    case 'reset':
      if (!['failed', 'paused', 'ready'].includes(task.state)) return task
      return move(task, 'queued', {
        common: { error: '', errorStage: undefined },
        transfer: {
          progress: 0,
          preparationProgress: 0,
          sessionId: undefined,
          token: undefined,
          endpoint: undefined,
          uploadUrl: undefined,
          sha256: undefined,
        },
        draft: { duplicateFile: undefined, duplicateOf: undefined },
      })
  }
}
