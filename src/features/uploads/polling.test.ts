import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUploadTask, type UploadTask } from './model'
import { POLL_BASE_MS, POLL_MAX_MS, pollDelay, useUploadPolling } from './polling'

function pending(id = 'task-1'): UploadTask {
  return {
    ...createUploadTask({
      id,
      name: 'a.flac',
      size: 1024,
      relativePath: 'album/a.flac',
      fingerprint: 'album/a.flac:1024:0',
      kind: 'audio',
    }),
    state: 'processing',
  }
}

afterEach(() => {
  vi.useRealTimers()
})

function track(task: UploadTask, onPoll: () => void) {
  const scope = effectScope()
  scope.run(() =>
    useUploadPolling(
      () => [task],
      async () => onPoll(),
    ),
  )
  return scope
}

describe('上传轮询：退避序列', () => {
  it('从 2s 起指数翻倍，封顶 30s', () => {
    expect(POLL_BASE_MS).toBe(2000)
    expect(POLL_MAX_MS).toBe(30_000)
    expect([0, 1, 2, 3, 4, 5, 9].map(pollDelay)).toEqual([
      2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000,
    ])
  })
})

describe('上传轮询：调度', () => {
  it('进入解析后立即轮询一次，之后按 2s、4s 退避', async () => {
    vi.useFakeTimers()
    const task = pending()
    let polls = 0
    const scope = track(task, () => (polls += 1))
    await vi.advanceTimersByTimeAsync(0)
    expect(polls).toBe(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(polls).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(polls).toBe(2)
    await vi.advanceTimersByTimeAsync(3999)
    expect(polls).toBe(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(polls).toBe(3)
    scope.stop()
  })

  it('状态变化后重置退避，任务离开解析就不再轮询', async () => {
    vi.useFakeTimers()
    const task = pending()
    let polls = 0
    const scope = track(task, () => {
      polls += 1
      if (polls === 2) task.state = 'published'
    })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(polls).toBe(2)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(polls).toBe(2)
    scope.stop()
  })

  it('非解析/入库状态不进入轮询', async () => {
    vi.useFakeTimers()
    const task = pending()
    task.state = 'uploading'
    let polls = 0
    const scope = track(task, () => (polls += 1))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(polls).toBe(0)
    scope.stop()
  })
})
