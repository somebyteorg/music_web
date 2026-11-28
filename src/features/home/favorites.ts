import type { Entity } from '@/types/catalog'

/**
 * 本地收藏：藏不住「后端没有收藏列表接口」这件事——
 * 详情页/列表点收藏时在这里留一条记录，首页「你的收藏」用它渲染。
 */
export interface FavoriteRecord {
  songId: string
  name: string
  artistName: string
  albumName: string
  at: number
}

/** 最多保留的收藏条数 */
export const FAVORITE_LIMIT = 100

/** 本地收藏变更事件：首页「你的收藏」楼层监听它刷新 */
export const FAVORITES_UPDATED_EVENT = 'music-home-favorites-updated'

const storageKey = (userId: number) => `music.home.favorites.v1.${userId}`

function isFavoriteRecord(value: unknown): value is FavoriteRecord {
  const record = value as FavoriteRecord | null
  return (
    !!record &&
    typeof record.songId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.at === 'number' &&
    Number.isFinite(record.at)
  )
}

/** 读本地收藏：损坏/结构不对就清掉并返回空数组 */
export function readFavorites(userId: number): FavoriteRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(storageKey(userId))
      return []
    }
    return parsed.filter(isFavoriteRecord)
  } catch {
    localStorage.removeItem(storageKey(userId))
    return []
  }
}

function writeFavorites(userId: number, list: FavoriteRecord[]): FavoriteRecord[] {
  const trimmed = [...list].sort((a, b) => b.at - a.at).slice(0, FAVORITE_LIMIT)
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(trimmed))
  } catch {
    /* 存不下就只留在内存里：首页收藏楼层下次打开会少这一条，不影响收藏本身 */
  }
  return trimmed
}

/** 收藏 / 取消收藏；返回落盘后的列表 */
export function setFavorite(userId: number, song: Entity, value: boolean): FavoriteRecord[] {
  const list = readFavorites(userId)
  const rest = list.filter((record) => record.songId !== song.id)
  if (!value) return writeFavorites(userId, rest)
  return writeFavorites(userId, [
    {
      songId: song.id,
      name: song.name,
      artistName: song.artists?.map((artist) => artist.name).join(' / ') || '未填写歌手',
      albumName: song.albums?.[0]?.name || '单曲',
      at: Date.now(),
    },
    ...rest,
  ])
}

/** 批量收藏/取消：只落盘一次，列表页勾选多首时用它 */
export function setFavorites(userId: number, songs: Entity[], value: boolean): FavoriteRecord[] {
  const removed = new Set(songs.map((song) => song.id))
  const rest = readFavorites(userId).filter((record) => !removed.has(record.songId))
  if (!value) return writeFavorites(userId, rest)
  const added = songs.map((song) => ({
    songId: song.id,
    name: song.name,
    artistName: song.artists?.map((artist) => artist.name).join(' / ') || '未填写歌手',
    albumName: song.albums?.[0]?.name || '单曲',
    at: Date.now(),
  }))
  return writeFavorites(userId, [...added, ...rest])
}

/**
 * 收藏类操作成功后的唯一写入点：本地留一条记录 + 广播事件，首页「你的收藏」楼层据此刷新。
 * 未登录 / 空列表直接忽略（收藏接口本身在那两种情况下也走不到）。
 */
export function syncFavorites(userId: number | undefined, songs: Entity[], value: boolean) {
  if (!userId || songs.length === 0) return
  setFavorites(userId, songs, value)
  window.dispatchEvent(new CustomEvent(FAVORITES_UPDATED_EVENT))
}

export function isFavorite(userId: number, songId: string): boolean {
  return readFavorites(userId).some((record) => record.songId === songId)
}
