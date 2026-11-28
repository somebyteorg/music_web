import type { Entity } from '@/types/catalog'
import type { PlayRecord } from './playHistory'

/**
 * 首页推荐的全部「规则」都在这里（纯函数 + 常量），组件只负责渲染。
 * 后端没有推荐接口，所以规则只用本地播放历史 + catalog 列表参数。
 */

/** 「猜你喜欢」每层 12 首，少于 4 首整层不渲染 */
export const ARTIST_ROW_SIZE = 12
export const ARTIST_ROW_MIN = 4
/** 继续听 8 条、常听专辑 6 张、其它楼层 12 首 */
export const CONTINUE_SIZE = 8
export const ALBUM_ROW_SIZE = 6
export const SONG_ROW_SIZE = 12
/** 随机漫游的页码上界：86 万首的曲库，前 50 页已经足够随机，也不会请求过深 */
export const RANDOM_PAGE_MAX = 50

/** 猜你喜欢：只推没听过的，最多 12 首 */
export function unheardSongs(items: Entity[], history: PlayRecord[]): Entity[] {
  const played = new Set(history.map((record) => record.songId))
  return items.filter((item) => !played.has(item.id)).slice(0, ARTIST_ROW_SIZE)
}

/** 随机漫游的页码（1..RANDOM_PAGE_MAX） */
export function randomPage(): number {
  return 1 + Math.floor(Math.random() * RANDOM_PAGE_MAX)
}

/** 把一组 id 拼成查询作用域（作为 keys.ts 里 key 的最后一段） */
export function idScope(ids: string[]): string {
  return ids.join(',')
}

/** 继续听的进度文案：有进度才显示 */
export function progressLabel(position: number | undefined, duration: number | null): string {
  if (position === undefined || !position) return '再听一次'
  if (!duration) return '继续播放'
  const percent = Math.round((position / duration) * 100)
  return `已听 ${Math.min(99, Math.max(1, percent))}%`
}
