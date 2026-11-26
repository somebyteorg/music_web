import { createUuid } from '@/utils/uuid'
import { prepareArtwork } from '@/utils/albumArtwork'
import type { Person } from '@/types/catalog'
import type { AudioFile } from '@/types/uploads'
import { createUploadTask, isUploadDone, TRANSMIT_STATES, type UploadTask } from './model'
import { fingerprintOfFile } from './transport'
import { type UploadOperationsDeps } from './operationContext'

/**
 * 任务集合类命令：入队、复用已有文件、移除、跳过、暂停。
 *
 * 只做编排：状态迁移交给状态机，网络交给 repository，传输交给 transport，
 * 快照与本地附件交给 persistence。
 */
export function createUploadTaskOperations(deps: UploadOperationsDeps) {
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

  function skip(task: UploadTask) {
    if (task.state !== 'duplicate') return
    deps.apply(task, { type: 'skipped' })
    deps.storage.files.delete(task.id)
    deps.storage.release(task.id)
  }

  function adopt(file: AudioFile): UploadTask {
    const existing = deps.tasks.value.find((task) => task.file?.id === file.id)
    if (existing) {
      if (!file.song_id) deps.finish(existing, file, existing.reused, 'reused')
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
        state: 'processing',
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

  return { add, pause, adopt, remove, forgetFile, skip }
}
