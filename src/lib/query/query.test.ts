import { effectScope } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearQueryCache, invalidateQueries, readCache, useQuery, writeCache } from './index'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('查询缓存', () => {
  beforeEach(() => clearQueryCache())

  it('写入后可按同一 key 读回，并带时间戳', () => {
    writeCache('u1:catalog:/albums', { items: [1, 2], total: 2 })
    const hit = readCache<{ items: number[]; total: number }>('u1:catalog:/albums')
    expect(hit?.data.total).toBe(2)
    expect(hit?.at).toBeGreaterThan(0)
  })

  it('未命中返回 null', () => {
    expect(readCache('nope')).toBeNull()
  })

  it('按前缀批量失效（例如某个用户下的 catalog）', () => {
    writeCache('u1:catalog:/albums', 1)
    writeCache('u1:catalog:/songs', 2)
    writeCache('u2:catalog:/albums', 3)
    invalidateQueries(['u1:catalog'])
    expect(readCache('u1:catalog:/albums')).toBeNull()
    expect(readCache('u1:catalog:/songs')).toBeNull()
    expect(readCache('u2:catalog:/albums')?.data).toBe(3)
  })

  it('超过上限时淘汰最旧的条目', () => {
    for (let i = 0; i < 55; i += 1) writeCache('k' + i, i)
    expect(readCache('k0')).toBeNull()
    expect(readCache('k54')?.data).toBe(54)
  })

  it('clear 清空全部', () => {
    writeCache('a', 1)
    clearQueryCache()
    expect(readCache('a')).toBeNull()
  })
})

describe('useQuery：同一 key 只保留最新一次请求', () => {
  beforeEach(() => clearQueryCache())

  it('后一次触发会取消前一次，旧响应不写回', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const responses = [first.promise, second.promise]
    const signals: AbortSignal[] = []
    const scope = effectScope()
    const query = scope.run(() =>
      useQuery<string>({
        key: () => 'u1:latest',
        fetcher: (signal) => {
          signals.push(signal)
          return responses[signals.length - 1]!
        },
      }),
    )!
    const older = query.run()
    const newer = query.run()
    expect(signals[0]!.aborted).toBe(true)
    first.resolve('旧结果')
    await older
    expect(query.data.value).toBeNull()
    expect(readCache('u1:latest')).toBeNull()
    second.resolve('新结果')
    await newer
    expect(query.data.value).toBe('新结果')
    expect(readCache<string>('u1:latest')?.data).toBe('新结果')
    scope.stop()
  })

  it('作用域销毁时取消在途请求', () => {
    const pending = deferred<string>()
    let signal: AbortSignal | undefined
    const scope = effectScope()
    const query = scope.run(() =>
      useQuery<string>({
        key: () => 'u1:inflight',
        fetcher: (request) => {
          signal = request
          return pending.promise
        },
      }),
    )!
    void query.run()
    scope.stop()
    expect(signal?.aborted).toBe(true)
  })
})
