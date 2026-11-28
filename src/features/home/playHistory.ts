import type { Entity } from '@/types/catalog'

/** 一条播放记录：按歌曲去重，plays 累加，lastPlayedAt 用于排序与淘汰 */
export interface PlayRecord {
  songId: string
  name: string
  artistId?: string
  artistName?: string
  albumId?: string
  albumName?: string
  plays: number
  lastPlayedAt: number
  position?: number
}

/** 最多保留的记录数：超出按 lastPlayedAt 淘汰最旧的 */
export const HISTORY_LIMIT = 200
/** 同一首在 30 分钟内重复播放视为同一次收听：只累加 plays，不刷新排序时间 */
const MERGE_WINDOW = 30 * 60 * 1000

/** 播放记录变更事件：首页楼层监听它刷新本地数据 */
export const HISTORY_UPDATED_EVENT = 'music-history-updated'

const storageKey = (userId: number) => `music.home.v1.${userId}`

function isRecord(value: unknown): value is PlayRecord {
  const record = value as PlayRecord | null
  return (
    !!record &&
    typeof record.songId === 'string' &&
    typeof record.name === 'string' &&
    typeof record.plays === 'number' &&
    Number.isFinite(record.plays) &&
    typeof record.lastPlayedAt === 'number' &&
    Number.isFinite(record.lastPlayedAt)
  )
}

/** 读历史：没有 / 损坏 / 结构不对都返回空数组，并把坏数据删掉（不用兜底掩盖问题） */
export function readHistory(userId: number): PlayRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(storageKey(userId))
      return []
    }
    return parsed.filter(isRecord)
  } catch {
    localStorage.removeItem(storageKey(userId))
    return []
  }
}

/** 写入并按 lastPlayedAt 淘汰；返回落盘后的列表，调用方直接拿去渲染 */
function writeHistory(userId: number, history: PlayRecord[]): PlayRecord[] {
  const trimmed = [...history]
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, HISTORY_LIMIT)
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(trimmed))
  } catch {
    /* 存储空间不足时静默失败：历史只是推荐的数据源，不影响播放本身 */
  }
  return trimmed
}

/**
 * 记一次播放。
 * - 同一首歌只有一条记录：30 分钟内再播只累加 plays（不刷新排序时间），超过 30 分钟才把它顶到最前
 * - 曲目信息每次刷新（改名/换封面后首页跟着更新）
 */
export function recordPlay(
  userId: number,
  song: Entity,
  options: { position?: number; now?: number } = {},
): PlayRecord[] {
  const now = options.now ?? Date.now()
  const history = readHistory(userId)
  const artist = song.artists?.[0]
  const album = song.albums?.[0]
  const existing = history.find((record) => record.songId === song.id)
  if (existing) {
    existing.plays += 1
    existing.name = song.name
    if (artist) {
      existing.artistId = artist.id
      existing.artistName = artist.name
    }
    if (album) {
      existing.albumId = album.id
      existing.albumName = album.name
    }
    if (options.position !== undefined) existing.position = options.position
    if (now - existing.lastPlayedAt > MERGE_WINDOW) existing.lastPlayedAt = now
    return writeHistory(userId, history)
  }
  const record: PlayRecord = { songId: song.id, name: song.name, plays: 1, lastPlayedAt: now }
  if (artist) {
    record.artistId = artist.id
    record.artistName = artist.name
  }
  if (album) {
    record.albumId = album.id
    record.albumName = album.name
  }
  if (options.position !== undefined) record.position = options.position
  return writeHistory(userId, [...history, record])
}

export interface ArtistTaste {
  artistId: string
  artistName: string
  plays: number
}

export interface AlbumTaste {
  albumId: string
  albumName: string
  plays: number
}

/** 听得最多的艺人（只统计带 artistId 的记录——「猜你喜欢」要靠 id 去查） */
export function topArtists(history: PlayRecord[], n: number): ArtistTaste[] {
  const totals = new Map<string, ArtistTaste>()
  for (const record of history) {
    if (!record.artistId) continue
    const current = totals.get(record.artistId)
    if (current) current.plays += record.plays
    else
      totals.set(record.artistId, {
        artistId: record.artistId,
        artistName: record.artistName || '未知歌手',
        plays: record.plays,
      })
  }
  return [...totals.values()].sort((a, b) => b.plays - a.plays).slice(0, n)
}

/** 听得最多的专辑 */
export function topAlbums(history: PlayRecord[], n: number): AlbumTaste[] {
  const totals = new Map<string, AlbumTaste>()
  for (const record of history) {
    if (!record.albumId) continue
    const current = totals.get(record.albumId)
    if (current) current.plays += record.plays
    else
      totals.set(record.albumId, {
        albumId: record.albumId,
        albumName: record.albumName || '未知专辑',
        plays: record.plays,
      })
  }
  return [...totals.values()].sort((a, b) => b.plays - a.plays).slice(0, n)
}

/** 继续听：最近播放的 n 条（带进度的那条会在卡片上显示进度） */
export function continueListening(history: PlayRecord[], n: number): PlayRecord[] {
  return [...history].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt).slice(0, n)
}

export function clearHistory(userId: number) {
  localStorage.removeItem(storageKey(userId))
}

/** 已听过的歌曲 id 集合：猜你喜欢要排除它们 */
export function playedSongIds(history: PlayRecord[]): Set<string> {
  return new Set(history.map((record) => record.songId))
}
