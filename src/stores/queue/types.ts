import type { Entity } from '@/types/catalog'
import { audioFileCount } from '@/utils/audio'

export type PlayMode = 'order' | 'repeat-all' | 'repeat-one' | 'shuffle'

export const playModes: PlayMode[] = ['order', 'repeat-all', 'repeat-one', 'shuffle']

export const playModeLabels: Record<PlayMode, string> = {
  order: '顺序播放',
  'repeat-all': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机播放',
}

export interface QueueEntry {
  key: string
  songId: string
  name: string
  artists: string
  album: string
  coverId: string | null
  imageUrl: string | null
  duration: number | null
  playable: boolean
}

/** 队列最多保留的曲目数量。 */
export const QUEUE_LIMIT = 1000

export function entryFromSong(song: Entity, index: number): QueueEntry {
  const album = song.albums?.[0]
  const audioCount = audioFileCount(song)
  return {
    key: song.entry_id || `${song.id}#${index}`,
    songId: song.id,
    name: song.name,
    artists: song.artists?.map((artist) => artist.name).join(' / ') || '未填写歌手',
    album: album?.name || '单曲',
    coverId: song.cover_id ?? album?.cover_id ?? null,
    imageUrl: song.image_url ?? album?.image_url ?? null,
    duration: song.duration ?? song.files?.[0]?.duration ?? null,
    playable: song.available !== false && audioCount !== undefined && audioCount > 0,
  }
}
