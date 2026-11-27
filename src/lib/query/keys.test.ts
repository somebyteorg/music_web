import { beforeEach, describe, expect, it } from 'vitest'
import { clearQueryCache, readCache, writeCache } from './index'
import { catalogKeys, detailKeys, invalidateScopes, keyPrefixes, pendingUploadKeys } from './keys'

const ALICE = 'u-alice'
const BOB = 'u-bob'

describe('key 约定', () => {
  it('catalog key 带用户与完整路径', () => {
    expect(catalogKeys(ALICE).page('/albums?page=2')).toBe('u-alice:catalog:/albums?page=2')
  })

  it('detail 与 detail-songs 分别带实体与分页', () => {
    expect(detailKeys(ALICE).item('songs', 's1')).toBe('u-alice:detail:songs:s1')
    expect(detailKeys(ALICE).songs('songs', 's1', 2, 48)).toBe('u-alice:detail-songs:songs:s1:2:48')
  })

  it('pending-uploads key 带页码', () => {
    expect(pendingUploadKeys(ALICE).page(3)).toBe('u-alice:pending-uploads:3')
  })

  it('prefix 展开成失效前缀列表', () => {
    expect(keyPrefixes(ALICE, ['catalog'])).toEqual(['u-alice:catalog:'])
    expect(keyPrefixes(ALICE, ['detail'])).toEqual(['u-alice:detail:', 'u-alice:detail-songs:'])
    expect(keyPrefixes(ALICE, ['pending-uploads'])).toEqual(['u-alice:pending-uploads:'])
    expect(keyPrefixes(ALICE, ['catalog', 'detail', 'pending-uploads'])).toHaveLength(4)
  })
})

describe('按前缀失效的边界', () => {
  beforeEach(() => {
    clearQueryCache()
    writeCache(catalogKeys(ALICE).page('/albums'), 'alice-albums')
    writeCache(catalogKeys(ALICE).page('/songs'), 'alice-songs')
    writeCache(catalogKeys(BOB).page('/albums'), 'bob-albums')
    writeCache(detailKeys(ALICE).item('songs', 's1'), 'alice-detail')
    writeCache(detailKeys(ALICE).songs('songs', 's1', 1, 48), 'alice-tracks')
    writeCache(pendingUploadKeys(ALICE).page(1), 'alice-pending')
    // 干扰项：前缀相近但属于别的作用域，不能被带走
    writeCache('u-alice:catalog-other:/albums', 'other-catalog')
    writeCache('u-alice:detail-other:songs:s1', 'other-detail')
    writeCache('u-alice:pending-uploads-other:1', 'other-pending')
  })

  it('catalog 只失效本用户的 catalog，不误命中 catalog-other', () => {
    invalidateScopes(ALICE, ['catalog'])
    expect(readCache(catalogKeys(ALICE).page('/albums'))).toBeNull()
    expect(readCache(catalogKeys(ALICE).page('/songs'))).toBeNull()
    expect(readCache(catalogKeys(BOB).page('/albums'))?.data).toBe('bob-albums')
    expect(readCache('u-alice:catalog-other:/albums')?.data).toBe('other-catalog')
    expect(readCache(detailKeys(ALICE).item('songs', 's1'))?.data).toBe('alice-detail')
  })

  it('detail 同时带走详情与曲目表，不误命中 detail-other', () => {
    invalidateScopes(ALICE, ['detail'])
    expect(readCache(detailKeys(ALICE).item('songs', 's1'))).toBeNull()
    expect(readCache(detailKeys(ALICE).songs('songs', 's1', 1, 48))).toBeNull()
    expect(readCache('u-alice:detail-other:songs:s1')?.data).toBe('other-detail')
    expect(readCache(catalogKeys(ALICE).page('/albums'))?.data).toBe('alice-albums')
  })

  it('pending-uploads 只失效本用户的待入库表', () => {
    invalidateScopes(ALICE, ['pending-uploads'])
    expect(readCache(pendingUploadKeys(ALICE).page(1))).toBeNull()
    expect(readCache('u-alice:pending-uploads-other:1')?.data).toBe('other-pending')
    expect(readCache(catalogKeys(ALICE).page('/albums'))?.data).toBe('alice-albums')
  })

  it('未登录时不做任何失效', () => {
    invalidateScopes(undefined, ['catalog', 'detail', 'pending-uploads'])
    expect(readCache(catalogKeys(ALICE).page('/albums'))?.data).toBe('alice-albums')
    expect(readCache(detailKeys(ALICE).item('songs', 's1'))?.data).toBe('alice-detail')
    expect(readCache(pendingUploadKeys(ALICE).page(1))?.data).toBe('alice-pending')
  })
})
