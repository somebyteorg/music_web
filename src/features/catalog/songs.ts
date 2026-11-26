import type { CatalogType, Entity } from '@/types/catalog'
import type { Page } from '@/types/common'
import { assertPage, catalogApi } from '@/lib/api/catalog'
import { MAX_PAGE_SIZE } from './limits'

/** 详情页按实体类型筛选曲目：专辑 / 歌手 / 媒体库各用不同参数 */
export function songFilter(type: CatalogType, id: string) {
  const filter: Record<string, string | number> = {}
  if (type === 'albums') filter.album_id = id
  if (type === 'artists') filter.artist_id = id
  if (type === 'libraries') filter.library_id = id
  return filter
}

export function getSongPage(
  type: CatalogType,
  id: string,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
): Promise<Page<Entity>> {
  return catalogApi.songs(type, id, { ...songFilter(type, id), page, page_size: pageSize }, signal)
}

export { assertPage }

/**
 * 翻页取某张专辑 / 歌单的全部曲目，最多 limit 首。
 * 页大小固定用后端上限，避免出现「请求一次拿全量」这种越界写法。
 */
export async function getAllSongs(
  type: CatalogType,
  id: string,
  limit: number,
): Promise<{ items: Entity[]; total: number }> {
  const items: Entity[] = []
  let total = Infinity
  for (let page = 1; items.length < limit && items.length < total; page += 1) {
    const result = assertPage(await getSongPage(type, id, page, MAX_PAGE_SIZE))
    total = Number(result.total)
    if (!result.items.length) break
    items.push(...result.items)
  }
  return { items: items.slice(0, limit), total }
}
