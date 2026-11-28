import { prepareUpload } from '@/utils/uploadPreparation'
import type { AudioFile } from '@/types/uploads'
import type { UploadEvent } from '../machine'
import { TRANSMIT_STATES, type UploadTask } from '../model'
import { uploadRepository } from '../repository'
import { applyTaskMetadata } from '../taskMetadata'
import { resumeUploadUrl } from './keys'

/** 传输前的公共依赖：状态迁移、收尾与中止判定都由 runner 显式传入，这里不持有闭包状态 */
export interface SessionContext {
  task: UploadTask
  signal: AbortSignal
  /** 被暂停 / 被取消 / 换了账号就抛 AbortError，交给 runner 的 catch 判阶段 */
  assertActive(): void
  apply(task: UploadTask, event: UploadEvent): void
  finish(task: UploadTask, file: AudioFile, reused?: boolean, kind?: 'processed' | 'reused'): void
  /** 轮询服务端处理状态，由 runner 提供 */
  poll(task: UploadTask): Promise<void>
}

/** 准备阶段额外要的两样东西：本地文件、队列快照（查重用）；快照用取值函数，取的时机不变 */
export interface PreparationContext extends SessionContext {
  file: File
  tasks(): UploadTask[]
}

/**
 * 服务端已有会话时优先还原：处理中/已完成直接接上，失败则给出可读原因。
 * 返回 true 表示任务已经收尾（或已转交轮询），run 不必再传。
 */
export async function restoreSession(context: SessionContext): Promise<boolean> {
  const { task, apply, finish } = context
  if (!task.transfer.sessionId) return false
  const response = await uploadRepository.getSession(task.transfer.sessionId, context.signal)
  context.assertActive()
  const status = response.session.status
  if (['processing', 'publishing', 'complete'].includes(status)) {
    apply(task, {
      type: 'sessionRestored',
      status: status === 'publishing' ? 'publishing' : 'processing',
    })
    if (status === 'complete' && response.file) finish(task, response.file)
    else await context.poll(task)
    return true
  }
  if (status === 'failed') {
    apply(task, {
      type: 'failed',
      stage: 'processing',
      error: response.session.error || '文件处理失败，请重新解析。',
    })
    return true
  }
  if (status === 'uploading' && !task.transfer.uploadUrl && response.session.tus_id)
    task.transfer.uploadUrl = resumeUploadUrl(task.transfer.endpoint, response.session.tus_id)
  return false
}

/**
 * 传输前的准备：算哈希/提歌词 → 查重 → 建会话，走完后任务上一定有 sessionId。
 * 返回 true 表示任务已经收尾（命中重复且封面已复用），run 不必再传。
 */
export async function prepareSession(context: PreparationContext): Promise<boolean> {
  const { task, apply, finish } = context
  if (
    !task.transfer.sha256 ||
    (!task.transfer.sessionId && task.kind === 'audio' && !task.transfer.preparedLyrics)
  ) {
    const prepared = await prepareUpload(
      context.file,
      task.kind === 'audio',
      context.signal,
      (metadata) => {
        if (!context.signal.aborted) applyTaskMetadata(task, metadata)
      },
      (progress) => {
        if (!context.signal.aborted)
          apply(task, { type: 'progress', preparationProgress: progress })
      },
    )
    context.assertActive()
    apply(task, {
      type: 'prepared',
      sha256: prepared.sha256,
      preparedLyrics: prepared.metadata.preparedLyrics || [],
    })
  }
  if (!task.transfer.sessionId) {
    if (task.state === 'preparing') apply(task, { type: 'prepared' })
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
      context.signal,
    )
    context.assertActive()
    const list = context.tasks()
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
      apply(task, {
        type: 'checked',
        duplicate: true,
        duplicateOf: source?.id,
        duplicateFile: existing.file || undefined,
      })
      if (task.kind === 'cover' && existing.file) finish(task, existing.file, true, 'reused')
      return true
    }
    apply(task, { type: 'checked', duplicate: false })
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
      context.signal,
    )
    context.assertActive()
    delete task.transfer.preparedLyrics
    apply(task, {
      type: 'sessionCreated',
      sessionId: response.session.id,
      token: response.token,
      endpoint: response.endpoint,
    })
    return false
  }
  apply(task, {
    type: 'sessionCreated',
    sessionId: task.transfer.sessionId,
    token: task.transfer.token,
    endpoint: task.transfer.endpoint,
    uploadUrl: task.transfer.uploadUrl,
  })
  return false
}
