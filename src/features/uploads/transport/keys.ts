import type { UploadTask } from '../model'

/** 队列里用于去重的稳定指纹：路径 + 大小 + 修改时间 */
export function fingerprintOfFile(file: File) {
  return [file.webkitRelativePath || file.name, file.size, file.lastModified].join(':')
}

/** tus 自己的断点续传指纹：按用户 + 会话隔离，避免跨账号串传 */
export function uploadFingerprint(userId: number, task: UploadTask) {
  return `music:${userId}:${task.transfer.sessionId}:${task.fingerprint}`
}

/** 服务端恢复会话时，把 tus_id 还原成可续传的 uploadUrl */
export function resumeUploadUrl(endpoint: string | undefined, tusId: string) {
  if (!endpoint) return undefined
  return `${endpoint.replace(/\/$/, '')}/${tusId.split('/').map(encodeURIComponent).join('/')}`
}
