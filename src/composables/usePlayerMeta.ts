import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playModeLabels, useQueueStore } from '@/stores/queue'
import { qualities } from '@/utils/format'

/**
 * 播放器四个子组件与全屏歌词页共用的派生值：封面条目、歌手、副标题、总时长、循环模式文案。
 * 同一个 computed 只在这里算一次，别在多个组件里各写一遍。
 */
export function usePlayerMeta() {
  const player = usePlayerStore()
  const queue = useQueueStore()

  /** 播放中的歌曲优先，没有就用队列当前项拼一份最小的封面信息 */
  const displayItem = computed(() => {
    if (player.song) return player.song
    const entry = queue.current
    return entry
      ? { id: entry.songId, name: entry.name, cover_id: entry.coverId, image_url: entry.imageUrl }
      : undefined
  })

  const artist = computed(() => {
    const artists = player.song?.artists
    if (artists && artists.length > 0) return artists.map((item) => item.name).join(' / ')
    return queue.current ? queue.current.artists : ''
  })

  const subtitle = computed(() => {
    if (player.file) return `${qualities[player.file.quality]} · ${player.file.codec.toUpperCase()}`
    return queue.current ? '已暂停' : ''
  })

  const modeLabel = computed(() => playModeLabels[queue.mode])

  const totalLength = computed(() => player.length || queue.current?.duration || 0)

  return { displayItem, artist, subtitle, modeLabel, totalLength }
}
