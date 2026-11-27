import type { Person } from '@/types/catalog'
import type { AudioFile } from '@/types/uploads'
import type { UploadTask } from './model'
import { fingerprintOfFile } from './transport'
import { uploadRepository } from './repository'
import { type UploadOperationsDeps, operationError } from './operationContext'

/**
 * 任务恢复类命令：继续、重试、重新上传、批量重试、复用重复文件、封面上传等待。
 * 与操作集合共用一套依赖，额外拿到 add 用于封面上传。
 */
export function createUploadRecovery(
  deps: UploadOperationsDeps,
  add: (files: FileList | File[], options?: { kind?: 'cover'; song?: Person }) => Promise<number>,
) {
  async function resumeTask(task: UploadTask) {
    task.error = ''
    const { transfer } = task
    if (transfer.file && task.draft.pendingPublish && task.errorStage === 'publishing') {
      await deps.publish(task, task.draft.pendingPublish)
      return
    }
    if (transfer.sessionId) {
      const response = await uploadRepository.getSession(transfer.sessionId)
      const status = response.session.status
      if (['processing', 'publishing', 'complete'].includes(status)) {
        deps.apply(task, {
          type: 'sessionRestored',
          status: status === 'publishing' ? 'publishing' : 'processing',
        })
        if (status === 'complete' && response.file) deps.finish(task, response.file)
        else await deps.runner.poll(task)
        return
      }
      if (status === 'failed') {
        await uploadRepository.retry(transfer.sessionId)
        deps.apply(task, { type: 'sessionRestored' })
        return
      }
      if (new Date(response.session.expires_at || '').getTime() < Date.now()) {
        transfer.sessionId = undefined
        transfer.token = undefined
        transfer.uploadUrl = undefined
        transfer.endpoint = undefined
        transfer.progress = 0
      }
    }
    if (!deps.storage.files.has(task.id)) {
      deps.apply(task, { type: 'paused' })
      task.error = '重新选择原文件或原文件夹后，即可继续上传。'
      return
    }
    deps.apply(task, { type: 'retried' })
    deps.pump()
  }

  async function retry(task: UploadTask) {
    try {
      await resumeTask(task)
    } catch (error) {
      const message = operationError(error)
      if (!['ready', 'processing', 'publishing'].includes(task.state))
        deps.apply(task, {
          type: 'failed',
          stage: task.errorStage || 'preparation',
          error: message,
        })
      task.error = message
      throw error
    }
  }

  function restart(task: UploadTask) {
    if (!['failed', 'paused'].includes(task.state)) return
    deps.apply(task, { type: 'reset' })
    if (!deps.storage.files.has(task.id)) {
      deps.apply(task, { type: 'paused' })
      task.error = '请重新选择原文件或文件夹，开始重新上传。'
    }
    deps.pump()
  }

  async function retryAll(scope = deps.tasks.value, onlyFailed = false) {
    const candidates = scope.filter(
      (task) =>
        task.state === 'failed' ||
        (task.state === 'ready' && task.errorStage === 'publishing' && !!task.error) ||
        (!onlyFailed && task.state === 'paused'),
    )
    const results = await Promise.allSettled(candidates.map(retry))
    return results.filter((result) => result.status === 'rejected').length
  }

  function duplicateFile(task: UploadTask) {
    return (
      task.draft.duplicateFile ||
      deps.tasks.value.find((entry) => entry.id === task.draft.duplicateOf)?.transfer.file
    )
  }

  async function useDuplicate(task: UploadTask) {
    let file = duplicateFile(task)
    if (!file) throw new Error('相同文件仍在处理中，请稍后再试。')
    if (
      task.batchId &&
      task.transfer.sha256 &&
      !file.upload_context?.some(
        (context) =>
          context.batch_id === task.batchId && context.relative_path === task.relativePath,
      )
    ) {
      const result = await uploadRepository.checkDuplicate({
        sha256: task.transfer.sha256,
        kind: task.kind,
        file_size: task.size,
        context: { batch_id: task.batchId, relative_path: task.relativePath },
      })
      if (!result.file) throw new Error('已有文件已被删除，请重新上传。')
      file = result.file
    }
    const { targetSongId } = task.metadata
    if (targetSongId && file.song_id && file.song_id !== targetSongId)
      throw new Error('相同文件已关联其他歌曲，请到原歌曲页面移动音频。')
    if (targetSongId && !file.song_id) {
      deps.apply(task, { type: 'publishingStarted' })
      deps.publishing.add(task.id)
      try {
        const result = await uploadRepository.publishFile(file.id, { song_id: targetSongId })
        deps.finish(task, { ...result.file, preview: file.preview }, true)
      } catch (error) {
        deps.apply(task, { type: 'checked', duplicate: true })
        throw error
      } finally {
        deps.publishing.delete(task.id)
      }
    } else deps.finish(task, file, true, 'reused')
  }

  async function cover(file: File): Promise<AudioFile> {
    const fingerprint = fingerprintOfFile(file)
    await add([file], { kind: 'cover' })
    const task = [...deps.tasks.value]
      .reverse()
      .find((entry) => entry.kind === 'cover' && entry.fingerprint === fingerprint)
    if (!task) throw new Error('封面超出大小上限或格式不支持。')
    if (task.state === 'failed') await retry(task)
    if (task.transfer.file) return task.transfer.file
    return new Promise((resolve, reject) => {
      let reusing = false
      const timer = setInterval(() => {
        if (task.state === 'duplicate' && duplicateFile(task) && !reusing) {
          reusing = true
          void useDuplicate(task).catch((error) => {
            clearInterval(timer)
            reject(error)
          })
        }
        if (task.transfer.file) {
          clearInterval(timer)
          resolve(task.transfer.file)
        } else if (
          task.state === 'failed' ||
          task.state === 'paused' ||
          task.state === 'skipped' ||
          !deps.tasks.value.some((entry) => entry.id === task.id) ||
          deps.userId() === undefined ||
          (task.draft.duplicateOf &&
            deps.tasks.value.find((entry) => entry.id === task.draft.duplicateOf)?.state ===
              'failed')
        ) {
          clearInterval(timer)
          reject(new Error(task.error || '封面没有上传完成。'))
        }
      }, 500)
    })
  }

  return { resumeTask, retry, restart, retryAll, duplicateFile, useDuplicate, cover }
}
