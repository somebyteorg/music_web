import type { CatalogType, Entity } from '@/types/catalog'
import type { Page } from '@/types/common'
import { request } from './client'

export type QueryParams = Record<string, string | number | undefined>

export function catalogPath(type: CatalogType, id?: string) {
  const collection = type === 'playlists' ? 'playlists' : `catalog/${type}`
  return id ? `${collection}/${id}` : collection
}

/** 列表接口的形状契约：不满足时抛可读错误，而不是让 undefined 静默变成 0 条 */
export function assertPage<T>(page: Page<T> | null | undefined): Page<T> {
  if (!page || !Array.isArray(page.items) || !Number.isFinite(Number(page.total)))
    throw new Error('接口返回的数据格式异常，请稍后重试。')
  return page
}

export const catalogApi = {
  async page(type: CatalogType, params: QueryParams, signal?: AbortSignal) {
    return assertPage(
      await request<Page<Entity>>(catalogPath(type), { searchParams: params, signal }),
    )
  },
  item(type: CatalogType, id: string, signal?: AbortSignal) {
    return request<{ item: Entity; can_edit?: boolean }>(catalogPath(type, id), { signal })
  },
  save(type: CatalogType, body: Record<string, unknown>, id?: string) {
    return request<{ item: Entity }>(catalogPath(type, id), {
      method: id ? 'PATCH' : 'POST',
      json: body,
    })
  },
  remove(type: CatalogType, id: string, body: Record<string, unknown>) {
    return request<void>(catalogPath(type, id), { method: 'DELETE', json: body })
  },
  /** 详情页曲目：歌单走 playlists/{id}/songs，其余走 catalog/songs */
  async songs(type: CatalogType, id: string, params: QueryParams, signal?: AbortSignal) {
    const page =
      type === 'playlists'
        ? await request<Page<Entity>>(`playlists/${id}/songs`, { searchParams: params, signal })
        : await request<Page<Entity>>('catalog/songs', { searchParams: params, signal })
    return assertPage(page)
  },
  song(id: string, signal?: AbortSignal) {
    return request<{ item: Entity }>(`catalog/songs/${id}`, { signal })
  },
  favorite(id: string, value: boolean) {
    return request<void>(`songs/${id}/favorite`, { method: 'PUT', json: { favorite: value } })
  },
  privatePlaylist(id: string) {
    return request<{ message: string }>(`playlists/${id}/private`, { method: 'POST' })
  },
}
