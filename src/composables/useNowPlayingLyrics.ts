import { computed, ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { usePlayerStore } from '@/stores/player'
import type { LyricVersion } from '@/types/lyrics'
import { parseLyrics } from '@/utils/lyrics'

/** 预览页里的一行歌词：startTime 为 null 表示纯文本，没有时间轴、不做高亮。 */
export interface NowPlayingLine {
  startTime: number | null
  text: string
}

/** loading / ready / empty / error 四个状态显式区分，不用空数组兜底掩盖失败。 */
export type LyricsStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

/**
 * 歌词版本按歌曲 id 缓存（null 表示"这首歌确实没有歌词"）。
 * 放在模块作用域：关掉预览再打开、切走再切回都不重复请求，只有换歌才会重新解析。
 */
const versionCache = new Map<string, LyricVersion | null>()

function pickVersion(versions: LyricVersion[]): LyricVersion | null {
  const preferred = versions.find((version) => version.is_default)
  if (preferred) return preferred
  return versions.length > 0 ? versions[0] : null
}

/** 纯文本歌词：按行切开，没有时间轴 */
function plainLines(content: string): NowPlayingLine[] {
  return content
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ startTime: null, text }))
}

async function parseVersion(version: LyricVersion): Promise<NowPlayingLine[]> {
  if (version.format === 'text') return plainLines(version.content)
  const { lines } = await parseLyrics(version.content, version.format)
  return lines
    .map((line) => ({
      startTime: line.startTime,
      text: line.words
        .map((word) => word.word)
        .join('')
        .trim(),
    }))
    .filter((line) => line.text.length > 0)
}

/** 取一首歌的歌词版本：先用 song 自带的 lyrics，没有才请求一次详情 */
async function readVersion(songId: string, inline: LyricVersion[] | undefined) {
  if (versionCache.has(songId)) {
    const cached = versionCache.get(songId)
    return cached === undefined ? null : cached
  }
  let versions = inline
  if (!versions || versions.length === 0) {
    const { item } = await catalogApi.item('songs', songId)
    versions = item.lyrics
  }
  const version = versions && versions.length > 0 ? pickVersion(versions) : null
  versionCache.set(songId, version)
  return version
}

/**
 * 预览页歌词：取词 → 解析 → 跟随播放时间算 activeIndex。
 * 只在预览页打开时取词（关掉预览不打扰网络），切歌才重新解析。
 */
export function useNowPlayingLyrics() {
  const player = usePlayerStore()

  const status = ref<LyricsStatus>('idle')
  const lines = ref<NowPlayingLine[]>([])
  const message = ref('')
  /** 有时间轴才做高亮；纯文本歌词整篇静态显示 */
  const synced = computed(() => lines.value.some((line) => line.startTime !== null))
  /** 最后一个 startTime <= 当前播放时间的行；没有则为 -1 */
  const activeIndex = computed(() => {
    if (!synced.value) return -1
    const position = player.time * 1000
    let index = -1
    lines.value.forEach((line, i) => {
      if (line.startTime !== null && line.startTime <= position) index = i
    })
    return index
  })

  let loadedId: string | null = null
  let ticket = 0

  async function load(force = false) {
    const song = player.song
    if (!song) {
      loadedId = null
      lines.value = []
      message.value = ''
      status.value = 'empty'
      return
    }
    if (!force && loadedId === song.id) return
    const mine = ++ticket
    status.value = 'loading'
    message.value = ''
    try {
      const version = await readVersion(song.id, song.lyrics)
      if (mine !== ticket) return
      if (!version) {
        lines.value = []
        status.value = 'empty'
        loadedId = song.id
        return
      }
      const parsed = await parseVersion(version)
      if (mine !== ticket) return
      lines.value = parsed
      status.value = parsed.length > 0 ? 'ready' : 'empty'
      loadedId = song.id
    } catch (error) {
      if (mine !== ticket) return
      loadedId = null
      lines.value = []
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
    }
  }

  /** 失败重试：清掉这首歌的缓存，再取一次 */
  function retry() {
    const song = player.song
    if (song) versionCache.delete(song.id)
    void load(true)
  }

  watch(
    [() => player.song?.id, () => player.nowPlaying],
    () => {
      if (player.nowPlaying) void load()
    },
    { immediate: true },
  )

  return { status, lines, synced, activeIndex, message, retry }
}
