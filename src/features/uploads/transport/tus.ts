import type { UploadTask } from '../model'
import type { UploadTransfer } from '../taskStats'
import { loadTus, type TusUpload } from '../tusClient'
import { uploadFingerprint } from './keys'

/** 一次 tus 传输的全部输入：全部显式传入，不捕获 runner 的闭包状态 */
export interface TusTransferOptions {
  file: File
  task: UploadTask
  userId: number
  chunkSize: number
  /** 进度测速的历史，由 runner 持有；这里只读写当次任务的那一条 */
  transfers: Map<string, UploadTransfer>
  /** 百分比真的变了才回调，状态迁移仍交给 runner */
  onProgress(progress: number): void
  /** 把「中止本次传输」交给 runner，暂停/停止时由它调用 */
  onCancel(cancel: () => void): void
  /** 把传输实例交给 runner，便于统一 abort */
  onUpload(upload: TusUpload): void
}

/**
 * tus 的回调与选项配置：传完 resolve；失败或暂停 reject（暂停是 AbortError）。
 * 客户端加载失败会抛出可读原因，最终由 runner 落到 failed（阶段 = transfer）。
 */
export async function startTusTransfer(options: TusTransferOptions): Promise<void> {
  const { task, transfers } = options
  const { Upload } = await loadTus()
  await new Promise<void>((resolve, reject) => {
    options.onCancel(() => reject(new DOMException('上传已暂停。', 'AbortError')))
    const upload = new Upload(options.file, {
      endpoint: task.transfer.endpoint!,
      uploadUrl: task.transfer.uploadUrl,
      chunkSize: options.chunkSize,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      removeFingerprintOnSuccess: true,
      fingerprint: async () => uploadFingerprint(options.userId, task),
      metadata: { session_id: task.transfer.sessionId!, token: task.transfer.token! },
      onUploadUrlAvailable: () => {
        task.transfer.uploadUrl = upload.url || undefined
      },
      onProgress: (sent, total) => {
        const time = Date.now()
        const previous = transfers.get(task.id)
        const delta = previous ? time - previous.at : 0
        const rate = previous && delta > 0 ? (Math.max(0, sent - previous.sent) * 1000) / delta : 0
        transfers.set(task.id, {
          sent,
          at: time,
          speed: previous ? previous.speed * 0.65 + rate * 0.35 : 0,
        })
        const progress = Math.round((sent / total) * 100)
        if (progress !== task.transfer.progress) options.onProgress(progress)
      },
      onError: reject,
      onSuccess: () => resolve(),
    })
    options.onUpload(upload)
    upload.start()
  })
}
