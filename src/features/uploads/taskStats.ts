import { isUploadDone, type UploadState, type UploadTask } from './model'

export interface UploadTransfer {
  sent: number
  at: number
  speed: number
}

export function summarizeUploads(
  tasks: UploadTask[],
  transfers: ReadonlyMap<string, UploadTransfer>,
  now: number,
) {
  const counted = tasks.filter(
    (task) => !task.transfer.reused && !['duplicate', 'skipped'].includes(task.state),
  )
  const total = counted.reduce((sum, task) => sum + task.size, 0)
  const sent = counted.reduce(
    (sum, task) =>
      sum +
      Math.min(
        task.size,
        transfers.get(task.id)?.sent ?? (task.size * task.transfer.progress) / 100,
      ),
    0,
  )
  const speed = [...transfers.values()].reduce(
    (sum, transfer) => sum + (now - transfer.at < 4000 ? transfer.speed : 0),
    0,
  )
  const count = (states: UploadState[]) =>
    tasks.filter((task) => states.includes(task.state)).length
  return {
    total,
    sent,
    speed,
    remaining:
      speed > 0 &&
      !counted.some(
        (task) => ['paused', 'failed'].includes(task.state) && task.transfer.progress < 100,
      )
        ? Math.ceil(Math.max(0, total - sent) / speed)
        : null,
    progress: total ? Math.min(100, Math.round((sent / total) * 100)) : tasks.length ? 100 : 0,
    preparing: count(['preparing', 'checking']),
    uploading: count(['uploading']),
    transmitting: count(['queued', 'uploading']),
    processing: count(['processing']),
    publishing: count(['publishing']),
    ready: tasks.filter((task) => task.kind === 'audio' && task.state === 'ready').length,
    done: tasks.filter(isUploadDone).length,
    duplicate: count(['duplicate']),
    failed: tasks.filter(
      (task) =>
        task.state === 'failed' ||
        (task.state === 'ready' && task.errorStage === 'publishing' && !!task.error),
    ).length,
  }
}
