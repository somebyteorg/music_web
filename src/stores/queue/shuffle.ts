import type { PlayMode, QueueEntry } from './types'

/** 原地洗牌（Fisher-Yates）。 */
export function shuffleInPlace(list: QueueEntry[]) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
}

/** 打乱当前曲目之后的部分，返回新的队列数组。 */
export function shuffleRest(items: QueueEntry[], currentIndex: number): QueueEntry[] {
  const rest = items.slice(currentIndex + 1)
  shuffleInPlace(rest)
  return [...items.slice(0, currentIndex + 1), ...rest]
}

/** 切到随机模式：当前曲目固定首位，其余打乱。 */
export function shuffleAround(items: QueueEntry[], playing: QueueEntry | null): QueueEntry[] {
  const rest = items.filter((entry) => entry.key !== playing?.key)
  shuffleInPlace(rest)
  return playing ? [playing, ...rest] : rest
}

/** 以保存的顺序为基准重排队列（退出随机模式时用）。 */
export function restoreBaseOrder(items: QueueEntry[], base: string[]): QueueEntry[] {
  const order = new Map(base.map((key, index) => [key, index]))
  return [...items].sort(
    (a, b) =>
      (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.key) ?? Number.MAX_SAFE_INTEGER),
  )
}

/**
 * 计算下一首的下标；auto 表示由播放结束触发：单曲循环停在原地，队尾且不循环时返回 null。
 */
export function nextPosition(
  length: number,
  pos: number,
  mode: PlayMode,
  auto: boolean,
): number | null {
  if (!length) return null
  if (auto && mode === 'repeat-one') return pos
  if (pos + 1 < length) return pos + 1
  if (mode === 'repeat-all' || mode === 'shuffle') return 0
  if (auto) return null
  return 0
}

/** 计算上一首的下标；队首时按循环模式回到队尾，否则回到开头。 */
export function previousPosition(length: number, pos: number, mode: PlayMode): number {
  if (pos > 0) return pos - 1
  if (mode === 'repeat-all' || mode === 'shuffle') return length - 1
  return 0
}
