import type { InjectionKey, UnwrapRef } from 'vue'
import type { useSongLyrics } from '@/features/catalog/useSongLyrics'

/**
 * 歌词是一个「控制器对象」（状态 + 方法），由 DetailView 创建。
 * 走 provide/inject 而不是当 prop，避免子组件改父级数据（vue/no-mutating-props）。
 */
export const songLyricsKey: InjectionKey<UnwrapRef<ReturnType<typeof useSongLyrics>>> =
  Symbol('songLyrics')
