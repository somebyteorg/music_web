import type { CatalogType } from '@/types/catalog'

/** 曲目区的显式加载状态：idle = 尚未发起 / 歌曲详情不适用，绝不代表“空列表”。 */
export type TracksStatus = 'idle' | 'loading' | 'error' | 'ready'

export interface TracksStatusInput {
  type: CatalogType
  hasData: boolean
  busy: boolean
  error: string
}

/**
 * 状态优先级：错误 > 已有数据 > 加载中 > 未开始。
 * 错误优先，保证刷新/翻页失败不会被旧数据掩盖；已有数据时后台刷新继续展示旧列表。
 */
export function resolveTracksStatus(input: TracksStatusInput): TracksStatus {
  if (input.type === 'songs') return 'idle'
  if (input.error) return 'error'
  if (input.hasData) return 'ready'
  if (input.busy) return 'loading'
  return 'idle'
}

/** 只有 ready 才允许取曲目数据；其它状态是调用方时序错误，不做默认值兜底。 */
export function readTracksPage<T>(status: TracksStatus, data: T | null): T {
  if (status !== 'ready') throw new Error(`曲目数据未就绪时访问了歌曲列表（当前 ${status}）`)
  if (!data) throw new Error('曲目数据未就绪时访问了歌曲列表')
  return data
}
