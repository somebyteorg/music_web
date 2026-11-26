import type { ComputedRef } from 'vue'
import { useSignStore } from '@/stores/sign'
import type { AudioFile, PublishData } from '@/types/uploads'
import { reduceTask, type UploadEvent } from './machine'
import { uploadRepository } from './repository'
import type { UploadTask } from './model'

export function useUploadPublishing(tasks: ComputedRef<UploadTask[]>) {
  const sign = useSignStore()
  const publishing = new Set<string>()

  function apply(task: UploadTask, event: UploadEvent) {
    Object.assign(task, reduceTask(task, event))
  }

  function published(task: UploadTask, result: { file: AudioFile; song_id: string }) {
    const related = tasks.value.filter((entry) => entry.file?.id === result.file.id)
    if (!related.includes(task)) related.push(task)
    for (const entry of related) {
      entry.file = { ...result.file, preview: entry.file?.preview, metadata: null }
      apply(entry, {
        type: 'published',
        file: entry.file,
        songId: result.song_id,
        reused: entry.reused,
      })
    }
  }

  async function publish(task: UploadTask, data: PublishData) {
    if (!task.file) throw new Error('文件还未解析完成。')
    task.pendingPublish = data
    task.error = ''
    publishing.add(task.id)
    apply(task, { type: 'publishingStarted' })
    try {
      const result = await uploadRepository.publishFile(task.file.id, data)
      published(task, result)
      return result
    } catch (error) {
      apply(task, {
        type: 'failed',
        stage: 'publishing',
        error: error instanceof Error ? error.message : '加入曲库失败，请重试。',
        retryable: true,
      })
      throw error
    } finally {
      publishing.delete(task.id)
    }
  }

  async function publishMany(items: { task: UploadTask; data: PublishData }[]) {
    const userId = sign.user?.id
    for (let offset = 0; offset < items.length; offset += 100) {
      if (!userId || sign.user?.id !== userId)
        throw new Error('登录状态已改变，请重新打开上传队列。')
      const batch = items
        .slice(offset, offset + 100)
        .filter((item) => item.task.state === 'ready' && item.task.file)
      if (!batch.length) continue
      batch.forEach(({ task, data }) => {
        publishing.add(task.id)
        task.error = ''
        task.pendingPublish = data
        apply(task, { type: 'publishingStarted' })
      })
      try {
        const response = await uploadRepository.publishFiles(
          batch.map(({ task, data }) => ({ ...data, file_id: task.file!.id })),
        )
        for (const result of response.items) {
          const entry = batch.find((item) => item.task.file?.id === result.file.id)
          if (entry) published(entry.task, result)
        }
      } catch (error) {
        batch.forEach(({ task }) =>
          apply(task, {
            type: 'failed',
            stage: 'publishing',
            error: error instanceof Error ? error.message : '批量入库失败。',
            retryable: true,
          }),
        )
        throw error
      } finally {
        batch.forEach(({ task }) => publishing.delete(task.id))
      }
    }
  }

  return { publishing, published, publish, publishMany }
}
