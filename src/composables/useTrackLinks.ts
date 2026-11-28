import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'

/**
 * 全屏页里「曲名 / 歌手」的详情页链接：
 * - to 由当前曲目生成：/songs/{songId}、/artists/{首个歌手 id}
 * - 点击时**先 el player.closeNowPlaying()，再 router.push**，否则浮层会盖在新页面上
 * - 带修饰键 / 中键时把事件交回浏览器（新标签页、新窗口照常）
 */
export function useTrackLinks() {
  const router = useRouter()
  const player = usePlayerStore()
  const { displayItem, artist } = usePlayerMeta()

  const songPath = computed(() => {
    const item = displayItem.value
    return item ? '/songs/' + item.id : ''
  })

  /** 歌手链接只认「歌曲实体的第一个歌手 id」；队列兜底的 displayItem 没有 artists，这时不渲染链接 */
  const artistPath = computed(() => {
    const artists = player.song?.artists
    if (!artists || artists.length === 0) return ''
    const id = artists[0].id
    return id ? '/artists/' + id : ''
  })

  function follow(event: MouseEvent, path: string) {
    if (!path) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return
    event.preventDefault()
    player.closeNowPlaying()
    void router.push(path)
  }

  return { displayItem, artist, songPath, artistPath, follow }
}
