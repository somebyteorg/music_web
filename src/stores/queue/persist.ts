import { playModes, type PlayMode, type QueueEntry } from './types'

/** 队列持久化使用的 localStorage 键。 */
export const storageKey = (userId: number) => `music.queue.v1.${userId}`

/** 本地队列的存储结构，字段名与历史写入保持一致。 */
export interface QueueSnapshot {
  items: QueueEntry[]
  pos: number
  mode: PlayMode
  source: string
  base: string[] | null
}

export function isEntry(value: unknown): value is QueueEntry {
  const entry = value as QueueEntry | null
  return !!entry && typeof entry.key === 'string' && typeof entry.songId === 'string'
}

/** 读取并清洗本地队列；没有记录或数据损坏时返回 null。 */
export function loadSnapshot(userId: number): QueueSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const data = JSON.parse(raw) as {
      items?: unknown
      pos?: unknown
      mode?: unknown
      source?: unknown
      base?: unknown
    }
    if (!Array.isArray(data.items)) return null
    const items = data.items.filter(isEntry)
    return {
      items,
      pos: typeof data.pos === 'number' && data.pos < items.length ? data.pos : -1,
      mode: playModes.includes(data.mode as PlayMode) ? (data.mode as PlayMode) : 'order',
      source: typeof data.source === 'string' ? data.source : '',
      base: Array.isArray(data.base)
        ? data.base.filter((key): key is string => typeof key === 'string')
        : null,
    }
  } catch {
    /* 损坏的本地队列直接忽略。 */
    return null
  }
}

/** 写入本地队列；参数显式传入，字段顺序与历史写入保持一致。 */
export function saveSnapshot(
  userId: number,
  items: QueueEntry[],
  pos: number,
  mode: PlayMode,
  source: string,
  base: string[] | null,
): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify({ items, pos, mode, source, base }))
  } catch {
    /* 存储空间不足时静默失败，队列仍在内存里可用。 */
  }
}
