import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'
import { useNowPlayingLyrics } from '@/composables/useNowPlayingLyrics'

/**
 * 歌词状态（取词 / 解析 / 高亮）由预览页外壳取一次，卡片级空态与右栏列表共用同一份，
 * 避免两处各取一遍、各解析一遍。
 */
export type NowPlayingLyricsContext = ReturnType<typeof useNowPlayingLyrics>

const key: InjectionKey<NowPlayingLyricsContext> = Symbol('now-playing-lyrics')

export function provideNowPlayingLyrics(context: NowPlayingLyricsContext) {
  provide(key, context)
}

export function useNowPlayingLyricsContext() {
  const context = inject(key)
  if (!context) throw new Error('useNowPlayingLyricsContext 必须在 NowPlaying 内部使用')
  return context
}
