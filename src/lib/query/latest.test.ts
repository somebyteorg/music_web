import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'
import { useLatest } from './index'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function scoped() {
  const scope = effectScope()
  const latest = scope.run(() => useLatest())!
  return { scope, latest }
}

describe('useLatest：只保留最新一次请求', () => {
  it('连续触发时取消上一次，旧结果不写回', async () => {
    const { scope, latest } = scoped()
    const first = deferred<string>()
    const second = deferred<string>()
    let firstSignal: AbortSignal | undefined
    const older = latest.run((signal) => {
      firstSignal = signal
      return first.promise
    })
    const newer = latest.run(() => second.promise)
    expect(firstSignal?.aborted).toBe(true)
    first.resolve('旧结果')
    expect(await older).toEqual({ status: 'canceled' })
    second.resolve('新结果')
    expect(await newer).toEqual({ status: 'done', data: '新结果' })
    scope.stop()
  })

  it('busy 只在最新一次结束后复位', async () => {
    const { scope, latest } = scoped()
    const first = deferred<string>()
    const second = deferred<string>()
    const older = latest.run(() => first.promise)
    expect(latest.busy.value).toBe(true)
    const newer = latest.run(() => second.promise)
    first.resolve('旧')
    await older
    expect(latest.busy.value).toBe(true)
    second.resolve('新')
    await newer
    expect(latest.busy.value).toBe(false)
    scope.stop()
  })

  it('失败写进 error 并交给 onError', async () => {
    const scope = effectScope()
    const seen: unknown[] = []
    const latest = scope.run(() => useLatest({ onError: (error) => seen.push(error) }))!
    const outcome = await latest.run(async () => {
      throw new Error('接口失败了。')
    })
    expect(outcome.status).toBe('failed')
    expect(latest.error.value).toBe('接口失败了。')
    expect(seen).toHaveLength(1)
    expect(latest.busy.value).toBe(false)
    scope.stop()
  })

  it('被取代的请求取消时不报错', async () => {
    const scope = effectScope()
    const seen: unknown[] = []
    const latest = scope.run(() => useLatest({ onError: (error) => seen.push(error) }))!
    const first = deferred<string>()
    const older = latest.run(() => first.promise)
    const newer = latest.run(async () => '新')
    first.reject(new Error('取消导致的拒绝'))
    expect(await older).toEqual({ status: 'canceled' })
    expect(seen).toHaveLength(0)
    expect(latest.error.value).toBe('')
    expect((await newer).status).toBe('done')
    scope.stop()
  })

  it('作用域销毁时取消在途请求', async () => {
    const { scope, latest } = scoped()
    const pending = deferred<string>()
    let signal: AbortSignal | undefined
    const running = latest.run((request) => {
      signal = request
      return pending.promise
    })
    scope.stop()
    expect(signal?.aborted).toBe(true)
    pending.reject(new Error('aborted'))
    expect(await running).toEqual({ status: 'canceled' })
  })
})
