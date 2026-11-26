import type { ComputedRef } from 'vue'
import { createUuid } from '@/utils/uuid'
import { prepareArtwork } from '@/utils/albumArtwork'
import type { Person } from '@/types/catalog'
import type { ContributionConfig } from '@/types/session'
import type { AudioFile, PublishData } from '@/types/uploads'
import { createUploadTask, isUploadDone, TRANSMIT_STATES, type UploadTask } from './model'
import type { UploadEvent } from './machine'
import { uploadRepository } from './repository'
import { fingerprintOfFile, type UploadRunner } from './transport'
import type { UploadPersistence } from './persistence'

export interface UploadOperationsDeps {
  tasks: ComputedRef<UploadTask[]>
  storage: UploadPersistence
  runner: UploadRunner
  publishing: Set<string>
  config(): ContributionConfig | null
  userId(): number | undefined
  apply(task: UploadTask, event: UploadEvent): void
  finish(task: UploadTask, file: AudioFile, reused?: boolean): void
  pump(): void
  publish(task: UploadTask, data: PublishData): Promise<unknown>
}

function errorMessage(error: unknown, fallback = '暂时无法恢复任务，请重试。') {
  return error instanceof Error ? error.message : fallback
}

/**
 * 任务级命令：把文件加入队列、暂停/继续/重试/移除、处理重复与封面等待。
 *
 * 只做编排：状态迁移交给状态机，网络交给 repository，传输交给 transport，
 * 快照与本地附件交给 persistence。
 */
export function createUploadOperations(deps: UploadOperationsDeps) {
  function saveTask(task: UploadTask) {
    const userId = deps.userId()
    if (userId === undefined) throw new Error('请先登录再上传。')
    deps.storage.push(userId, task)
    return deps.tasks.value.find((entry) => entry.id === task.id)!
  }

  async function add(files: FileList | File[], options: { kind?: 'cover'; song?: Person } = {}) {
    const config = deps.config()
    if (!config || deps.userId() === undefined) throw new Error('请先登录再上传。')
    let skipped = 0
    const batchId = createUuid()
    for (const source of Array.from(files)) {
      const extension = source.name.split('.').pop()?.toLowerCase() || ''
      const kind =
        options.kind ||
        (config.audio_extensions.includes(extension)
          ? 'audio'
          : config.cover_extensions.includes(extension)
            ? 'cover'
            : null)
      if (
        !kind ||
        (options.song && kind !== 'audio') ||
        source.size === 0 ||
        (kind === 'audio' && source.size > config.max_file_size)
      ) {
        skipped++
        continue
      }
      let file = source
      if (kind === 'cover' && file.size > config.max_cover_size) {
        deps.pump()
        try {
          file = await prepareArtwork(file, config.max_cover_size)
        } catch {
          skipped++
          continue
        }
        if (file.size > config.max_cover_size) {
          skipped++
          continue
        }
      }
      const fingerprint = fingerprintOfFile(source)
      const existing = deps.tasks.value.find(
        (entry) =>
          entry.fingerprint === fingerprint &&
          entry.targetSongId === options.song?.id &&
          !isUploadDone(entry),
      )
      if (existing) {
        deps.storage.attach(existing, file)
        if (existing.state === 'paused') deps.apply(existing, { type: 'resumed' })
        continue
      }
      const task = saveTask(
        createUploadTask({
          id: createUuid(),
          name: file.name,
          size: file.size,
          relativePath: file.webkitRelativePath || file.name,
          fingerprint,
          batchId,
          kind,
          targetSongId: options.song?.id,
          targetSongName: options.song?.name,
        }),
      )
      deps.storage.attach(task, file)
    }
    deps.pump()
    return skipped
  }

  function pause(task: UploadTask) {
    return deps.runner.pause(task)
  }

  async function resumeTask(task: UploadTask) {
    task.error = ''
    if (task.file && task.pendingPublish && task.errorStage === 'publishing') {
      await deps.publish(task, task.pendingPublish)
      return
    }
    if (task.sessionId) {
      const response = await uploadRepository.getSession(task.sessionId)
      const status = response.session.status
      if (['processing', 'publishing', 'complete'].includes(status)) {
        deps.apply(task, {
          type: 'transferred',
          status: status === 'publishing' ? 'publishing' : 'processing',
        })
        if (status === 'complete' && response.file) deps.finish(task, response.file)
        else await deps.runner.poll(task)
        return
      }
      if (status === 'failed') {
        await uploadRepository.retry(task.sessionId)
        deps.apply(task, { type: 'transferred' })
        return
      }
      if (new Date(response.session.expires_at || '').getTime() < Date.now()) {
        task.sessionId = undefined
        task.token = undefined
        task.uploadUrl = undefined
        task.endpoint = undefined
        task.progress = 0
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
      const message = errorMessage(error)
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
      task.duplicateFile || deps.tasks.value.find((entry) => entry.id === task.duplicateOf)?.file
    )
  }

  async function useDuplicate(task: UploadTask) {
    let file = duplicateFile(task)
    if (!file) throw new Error('相同文件仍在处理中，请稍后再试。')
    if (
      task.batchId &&
      task.sha256 &&
      !file.upload_context?.some(
        (context) =>
          context.batch_id === task.batchId && context.relative_path === task.relativePath,
      )
    ) {
      const result = await uploadRepository.checkDuplicate({
        sha256: task.sha256,
        kind: task.kind,
        file_size: task.size,
        context: { batch_id: task.batchId, relative_path: task.relativePath },
      })
      if (!result.file) throw new Error('已有文件已被删除，请重新上传。')
      file = result.file
    }
    if (task.targetSongId && file.song_id && file.song_id !== task.targetSongId)
      throw new Error('相同文件已关联其他歌曲，请到原歌曲页面移动音频。')
    if (task.targetSongId && !file.song_id) {
      deps.apply(task, { type: 'transferred', status: 'publishing' })
      deps.publishing.add(task.id)
      try {
        const result = await uploadRepository.publishFile(file.id, { song_id: task.targetSongId })
        deps.finish(task, { ...result.file, preview: file.preview }, true)
      } catch (error) {
        deps.apply(task, { type: 'checked', duplicate: true })
        throw error
      } finally {
        deps.publishing.delete(task.id)
      }
    } else deps.finish(task, file, true)
  }

  function skip(task: UploadTask) {
    if (task.state !== 'duplicate') return
    deps.apply(task, { type: 'skipped' })
    deps.storage.files.delete(task.id)
    deps.storage.release(task.id)
  }

  function adopt(file: AudioFile): UploadTask {
    const existing = deps.tasks.value.find((task) => task.file?.id === file.id)
    if (existing) {
      if (!file.song_id) deps.finish(existing, file, existing.reused)
      existing.file = { ...file, metadata: null }
      return existing
    }
    const task = saveTask(
      createUploadTask({
        id: createUuid(),
        name: file.file_name,
        size: file.file_size,
        relativePath: file.upload_context?.at(-1)?.relative_path || file.file_name,
        fingerprint: '',
        batchId: file.upload_context?.at(-1)?.batch_id,
        kind: file.kind,
      }),
    )
    deps.finish(task, file)
    return task
  }

  async function remove(task: UploadTask) {
    if (['processing', 'publishing'].includes(task.state)) return
    if (TRANSMIT_STATES.includes(task.state)) await pause(task)
    deps.storage.drop(deps.userId(), task.id)
    for (const dependent of deps.tasks.value.filter(
      (entry) => entry.state === 'duplicate' && entry.duplicateOf === task.id,
    )) {
      dependent.duplicateOf = undefined
      if (task.file) dependent.duplicateFile = task.file
      else if (deps.storage.files.has(dependent.id)) deps.apply(dependent, { type: 'retried' })
      else {
        deps.apply(dependent, { type: 'paused' })
        dependent.error = '请重新选择原文件，继续校验和上传。'
      }
    }
    deps.storage.files.delete(task.id)
    deps.storage.release(task.id)
    deps.runner.transfers.delete(task.id)
    deps.pump()
  }

  async function forgetFile(id: string) {
    for (const task of [...deps.tasks.value]) {
      if (task.file?.id === id) await remove(task)
      else if (task.duplicateFile?.id === id) task.duplicateFile = undefined
    }
  }

  async function cover(file: File): Promise<AudioFile> {
    const fingerprint = fingerprintOfFile(file)
    await add([file], { kind: 'cover' })
    const task = [...deps.tasks.value]
      .reverse()
      .find((entry) => entry.kind === 'cover' && entry.fingerprint === fingerprint)
    if (!task) throw new Error('封面超出大小上限或格式不支持。')
    if (task.state === 'failed') await retry(task)
    if (task.file) return task.file
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
        if (task.file) {
          clearInterval(timer)
          resolve(task.file)
        } else if (
          task.state === 'failed' ||
          task.state === 'paused' ||
          task.state === 'skipped' ||
          !deps.tasks.value.some((entry) => entry.id === task.id) ||
          deps.userId() === undefined ||
          (task.duplicateOf &&
            deps.tasks.value.find((entry) => entry.id === task.duplicateOf)?.state === 'failed')
        ) {
          clearInterval(timer)
          reject(new Error(task.error || '封面没有上传完成。'))
        }
      }, 500)
    })
  }

  return {
    add,
    pause,
    resumeTask,
    retry,
    restart,
    retryAll,
    duplicateFile,
    useDuplicate,
    skip,
    adopt,
    remove,
    forgetFile,
    cover,
  }
}

export type UploadOperations = ReturnType<typeof createUploadOperations>
