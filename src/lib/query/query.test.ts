import { beforeEach, describe, expect, it } from 'vitest'
import { clearQueryCache, invalidateQueries, readCache, writeCache } from './index'

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
