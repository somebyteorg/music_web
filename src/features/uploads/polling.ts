import { onScopeDispose, watch } from 'vue'
import type { UploadState, UploadTask } from './model'

/** 轮询退避：2s → 4s → 8s → 16s → 30s（上限）。起点不放大，保证入库完成不被拖慢 */
export const POLL_BASE_MS = 2000
export const POLL_MAX_MS = 30_000
const POLLED_STATES: UploadState[] = ['processing', 'publishing']

export function pollDelay(attempt: number) {
  return Math.min(POLL_MAX_MS, POLL_BASE_MS * 2 ** Math.max(0, attempt))
}

/**
 * 单个文件的轮询调度：指数退避 + 页面隐藏暂停。
 *
 * - 任务进入解析 / 入库状态时立刻轮询一次，之后按退避序列重试
 * - 服务端状态变化后重置退避，回到 2s 起点
 * - 页面隐藏时停表，恢复可见后立即补一次并重新排期
 */
export function useUploadPolling(
  tasks: () => UploadTask[],
  poll: (task: UploadTask) => Promise<void>,
) {
  const attempts = new Map<string, number>()
  const due = new Map<string, number>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false

  function hidden() {
    return typeof document !== 'undefined' && document.hidden
  }

  function clear() {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
  }

  function watched() {
    return tasks().filter((task) => POLLED_STATES.includes(task.state))
  }

  async function runOne(task: UploadTask) {
    const before = task.state
    const attempt = attempts.get(task.id)
    if (attempt === undefined) throw new Error(`轮询任务 ${task.id} 缺少退避计数`)
    try {
      await poll(task)
    } catch {
      // 单次轮询失败不影响其它任务，错误信息由传输层写进任务
    } finally {
      if (task.state !== before) {
        attempts.delete(task.id)
        due.delete(task.id)
      } else {
        attempts.set(task.id, attempt + 1)
        due.set(task.id, Date.now() + pollDelay(attempt))
      }
    }
  }

  async function tick() {
    timer = undefined
    if (hidden() || running) return
    running = true
    try {
      const now = Date.now()
      const ready = watched().filter((task) => (due.get(task.id) ?? now) <= now)
      await Promise.all(ready.map(runOne))
    } finally {
      running = false
      schedule()
    }
  }

  function schedule() {
    clear()
    if (hidden()) return
    const now = Date.now()
    const ids = new Set<string>()
    let at = Infinity
    for (const task of watched()) {
      ids.add(task.id)
      if (!attempts.has(task.id)) attempts.set(task.id, 0)
      if (!due.has(task.id)) due.set(task.id, now)
      at = Math.min(at, due.get(task.id)!)
    }
    for (const id of [...attempts.keys()]) if (!ids.has(id)) attempts.delete(id)
    for (const id of [...due.keys()]) if (!ids.has(id)) due.delete(id)
    if (at === Infinity) return
    timer = setTimeout(() => void tick(), Math.max(0, at - now))
  }

  /** 立即补一轮（登录切换、页面恢复可见时用），并清掉已有退避 */
  function pollNow() {
    attempts.clear()
    for (const task of watched()) attempts.set(task.id, 0)
    for (const id of [...due.keys()]) due.set(id, Date.now())
    void tick()
  }

  function onVisibility() {
    if (hidden()) clear()
    else pollNow()
  }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  onScopeDispose(() => {
    clear()
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', onVisibility)
  })

  // 任务进入/离开解析、入库状态时重新排期
  watch(
    () =>
      tasks()
        .map((task) => `${task.id}:${task.state}`)
        .join('|'),
    schedule,
    { immediate: true },
  )

  return { schedule, pollNow }
}
