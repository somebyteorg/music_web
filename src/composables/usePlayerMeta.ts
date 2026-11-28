import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playModeLabels, useQueueStore } from '@/stores/queue'
import { fileUrl } from '@/utils/file'
import { qualities } from '@/utils/format'

/**
 * 播放器四个子组件与全屏歌词页共用的派生值：封面条目、封面地址、专辑名、歌手、
 * 副标题、总时长、循环模式文案。同一个 computed 只在这里算一次，别在多个组件里各写一遍。
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

  /** 封面地址：与 EntityCover 同一套判断（cover_id 走文件接口，否则退回 image_url），没有封面时为空串 */
  const coverSrc = computed(() => {
    const item = displayItem.value
    if (!item) return ''
    if (item.cover_id) return fileUrl(item.cover_id)
    return item.image_url || ''
  })

  const artist = computed(() => {
    const artists = player.song?.artists
    if (artists && artists.length > 0) return artists.map((item) => item.name).join(' / ')
    return queue.current ? queue.current.artists : ''
  })

  /** 头部行左侧：优先队列条目的专辑名，没有就退回歌曲专辑，再没有就是「正在播放」 */
  const albumName = computed(() => {
    const entry = queue.current
    if (entry && entry.album) return entry.album
    const album = player.song?.albums?.[0]
    return album ? album.name : '正在播放'
  })

  const subtitle = computed(() => {
    if (player.file) return `${qualities[player.file.quality]} · ${player.file.codec.toUpperCase()}`
    return queue.current ? '已暂停' : ''
  })

  const modeLabel = computed(() => playModeLabels[queue.mode])

  const totalLength = computed(() => player.length || queue.current?.duration || 0)

  return { displayItem, coverSrc, artist, albumName, subtitle, modeLabel, totalLength }
}
