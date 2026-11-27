import type { Entity } from '@/types/catalog'

/**
 * 音频数量：列表接口给 files_count，详情接口给 files。
 * 两者都没有时返回 undefined——「未知」不能伪装成 0。
 */
export function audioFileCount(song: Entity): number | undefined {
  if (song.files_count !== undefined) return song.files_count
  return song.files?.length
}

export function audioLabel(song: Entity): string {
  const count = audioFileCount(song)
  if (count === undefined) throw new Error(`歌曲 ${song.id} 缺少音频数量字段`)
  return `${count} 份音频`
}
