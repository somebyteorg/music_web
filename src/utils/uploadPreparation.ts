import type { UploadDraftMetadata } from '@/types/uploads'
import { prepareEmbeddedLyrics } from './lyrics'

interface Preparation {
  file: File
  audio: boolean
  signal: AbortSignal
  onMetadata: (metadata: UploadDraftMetadata) => void
  onProgress: (progress: number) => void
  resolve: (value: { sha256: string; metadata: UploadDraftMetadata }) => void
  reject: (error: Error) => void
}
const queue: Preparation[] = []
let active = 0

function pump() {
  while (active < 2 && queue.length) {
    const job = queue.shift()!
    if (job.signal.aborted) {
      job.reject(new DOMException('已暂停文件校验。', 'AbortError'))
      continue
    }
    active++
    let worker: Worker
    try {
      worker = new Worker(new URL('../workers/uploadPreparation.ts', import.meta.url), {
        type: 'module',
      })
    } catch (error) {
      active--
      job.reject(error instanceof Error ? error : new Error('无法启动文件校验。'))
      continue
    }
    let finished = false
    const finish = () => {
      if (finished) return false
      finished = true
      worker.terminate()
      job.signal.removeEventListener('abort', abort)
      active--
      pump()
      return true
    }
    const abort = () => {
      if (finish()) job.reject(new DOMException('已暂停文件校验。', 'AbortError'))
    }
    job.signal.addEventListener('abort', abort, { once: true })
    worker.onmessage = async (event: MessageEvent) => {
      if (event.data.type === 'metadata') job.onMetadata(event.data.metadata)
      else if (event.data.type === 'progress') job.onProgress(event.data.progress)
      else if (event.data.type === 'complete') {
        try {
          const { lyrics, ...metadata } = event.data.metadata as UploadDraftMetadata
          metadata.preparedLyrics = await prepareEmbeddedLyrics(lyrics || [], job.file.name)
          if (finish()) job.resolve({ sha256: event.data.sha256, metadata })
        } catch (error) {
          if (finish()) job.reject(error instanceof Error ? error : new Error('内嵌歌词处理失败。'))
        }
      } else if (event.data.type === 'error') {
        if (finish()) job.reject(new Error(event.data.message || '文件校验失败。'))
      }
    }
    worker.onerror = () => {
      if (finish()) job.reject(new Error('文件校验未能完成，请重试。'))
    }
    worker.postMessage({ file: job.file, audio: job.audio })
  }
}

export function prepareUpload(
  file: File,
  audio: boolean,
  signal: AbortSignal,
  onMetadata: Preparation['onMetadata'],
  onProgress: Preparation['onProgress'],
) {
  return new Promise<{ sha256: string; metadata: UploadDraftMetadata }>((resolve, reject) => {
    const job = { file, audio, signal, onMetadata, onProgress, resolve, reject }
    const abortQueued = () => {
      const index = queue.indexOf(job)
      if (index >= 0) {
        queue.splice(index, 1)
        reject(new DOMException('已暂停文件校验。', 'AbortError'))
      }
    }
    signal.addEventListener('abort', abortQueued, { once: true })
    queue.push(job)
    pump()
  })
}
