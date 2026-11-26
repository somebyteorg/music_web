import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entity } from '@/types/catalog'

// 只替换网络调用，保留真实的 assertPage（它会做形状校验）
vi.mock('@/lib/api/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/catalog')>()
  return { ...actual, catalogApi: { ...actual.catalogApi, songs: vi.fn() } }
})

import { catalogApi } from '@/lib/api/catalog'
import { MAX_PAGE_SIZE } from './limits'
import { getAllSongs } from './songs'

const songsMock = vi.mocked(catalogApi.songs)
const song = (i: number) => ({ id: 's' + i, name: '曲目 ' + i }) as unknown as Entity

function paginate(total: number) {
  return (...args: unknown[]) => {
    const params = (args[2] ?? {}) as { page?: number; page_size?: number }
    const page = Number(params.page ?? 1)
    const size = Number(params.page_size ?? 24)
    const start = (page - 1) * size + 1
    const items: Entity[] = []
    for (let i = start; i < start + size && i <= total; i += 1) items.push(song(i))
    return Promise.resolve({
      items,
      total,
      page,
      page_size: size,
      page_count: Math.ceil(total / size),
    })
  }
}

describe('getAllSongs', () => {
  beforeEach(() => songsMock.mockReset())

  it('按后端上限翻页取全量，页大小永远是 60', async () => {
    songsMock.mockImplementation(paginate(130) as never)
    const result = await getAllSongs('albums', 'a1', 1000)
    expect(result.items).toHaveLength(130)
    expect(result.total).toBe(130)
    expect(songsMock).toHaveBeenCalledTimes(3)
    for (const call of songsMock.mock.calls)
      expect((call[2] as { page_size: number }).page_size).toBe(MAX_PAGE_SIZE)
  })

  it('达到 limit 就停，不会多请求', async () => {
    songsMock.mockImplementation(paginate(500) as never)
    const result = await getAllSongs('albums', 'a1', 50)
    expect(result.items).toHaveLength(50)
    expect(songsMock).toHaveBeenCalledTimes(1)
  })

  it('接口形状异常时给出可读错误', async () => {
    songsMock.mockResolvedValue({} as never)
    await expect(getAllSongs('albums', 'a1', 10)).rejects.toThrow('数据格式异常')
  })
})
