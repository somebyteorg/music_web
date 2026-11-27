import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
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

const storageKey = (userId: number) => `music.queue.v1.${userId}`

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

function shuffleInPlace(list: QueueEntry[]) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
}

function isEntry(value: unknown): value is QueueEntry {
  const entry = value as QueueEntry | null
  return !!entry && typeof entry.key === 'string' && typeof entry.songId === 'string'
}

export const useQueueStore = defineStore('queue', () => {
  const items = ref<QueueEntry[]>([])
  const pos = ref(-1)
  const mode = ref<PlayMode>('order')
  const source = ref('')
  const open = ref(false)
  const baseOrder = ref<string[] | null>(null)
  const initialized = ref(false)
  let owner: number | null = null

  const current = computed(() => items.value[pos.value] ?? null)
  const length = computed(() => items.value.length)
  const progress = computed(() => (length.value ? `${pos.value + 1} / ${length.value}` : '0 / 0'))
  const hasPlayable = computed(() => items.value.some((entry) => entry.playable))
  const nextEntry = computed(() => {
    if (!items.value.length) return null
    if (pos.value + 1 < items.value.length) return items.value[pos.value + 1]
    return mode.value === 'repeat-all' || mode.value === 'shuffle' ? items.value[0] : null
  })

  function save() {
    if (!initialized.value || owner === null) return
    try {
      localStorage.setItem(
        storageKey(owner),
        JSON.stringify({
          items: items.value,
          pos: pos.value,
          mode: mode.value,
          source: source.value,
          base: baseOrder.value,
        }),
      )
    } catch {
      /* 存储空间不足时静默失败，队列仍在内存里可用。 */
    }
  }

  watch([items, pos, mode, source], save, { deep: true })

  function shuffleRest(currentIndex: number) {
    const rest = items.value.slice(currentIndex + 1)
    shuffleInPlace(rest)
    items.value = [...items.value.slice(0, currentIndex + 1), ...rest]
  }

  /** 用一份列表整体替换队列；start 为点击处下标。 */
  function replace(next: QueueEntry[], start: number, label = '') {
    const trimmed = next.length > QUEUE_LIMIT ? next.slice(0, QUEUE_LIMIT) : next
    items.value = trimmed
    pos.value = trimmed.length ? Math.min(Math.max(start, 0), trimmed.length - 1) : -1
    source.value = label
    baseOrder.value = null
    if (mode.value === 'shuffle' && pos.value >= 0) shuffleRest(pos.value)
  }

  function playList(entities: Entity[], start: number, label = ''): QueueEntry | null {
    const entries = entities.map((song, index) => entryFromSong(song, index))
    replace(entries, start, label)
    const from = Math.min(Math.max(start, 0), entries.length - 1)
    const playableFrom = entries.findIndex((entry, index) => index >= from && entry.playable)
    const playableAny = entries.findIndex((entry) => entry.playable)
    const target = playableFrom >= 0 ? playableFrom : playableAny
    pos.value = target
    return current.value
  }

  function append(entities: Entity[]) {
    const offset = items.value.length
    const added = entities.map((song, index) => entryFromSong(song, offset + index))
    items.value = [...items.value, ...added].slice(0, QUEUE_LIMIT)
    if (pos.value < 0) pos.value = 0
    return added
  }

  function insertNext(entities: Entity[]) {
    const added = entities.map((song, index) => entryFromSong(song, items.value.length + index))
    const at = pos.value + 1
    items.value = [...items.value.slice(0, at), ...added, ...items.value.slice(at)].slice(
      0,
      QUEUE_LIMIT,
    )
    if (pos.value < 0) pos.value = 0
    return added
  }

  function jump(key: string): QueueEntry | null {
    const index = items.value.findIndex((entry) => entry.key === key)
    if (index < 0) return null
    pos.value = index
    return current.value
  }

  function removeItem(key: string) {
    const index = items.value.findIndex((entry) => entry.key === key)
    if (index < 0) return
    items.value = items.value.filter((entry) => entry.key !== key)
    if (index < pos.value) pos.value -= 1
    else if (index === pos.value) pos.value = Math.min(pos.value, items.value.length - 1)
  }

  /** 返回下一首（auto 表示由播放结束触发）；队尾且不循环时返回 null。 */
  function advance(auto = false): QueueEntry | null {
    if (!items.value.length) return null
    if (auto && mode.value === 'repeat-one') return current.value
    if (pos.value + 1 < items.value.length) {
      pos.value += 1
      return current.value
    }
    if (mode.value === 'repeat-all' || mode.value === 'shuffle') {
      pos.value = 0
      return current.value
    }
    if (auto) return null
    pos.value = 0
    return current.value
  }

  function previous(): QueueEntry | null {
    if (!items.value.length) return null
    if (pos.value > 0) {
      pos.value -= 1
      return current.value
    }
    if (mode.value === 'repeat-all' || mode.value === 'shuffle') {
      pos.value = items.value.length - 1
      return current.value
    }
    pos.value = 0
    return current.value
  }

  function setMode(next: PlayMode) {
    if (next === mode.value) return
    const playing = current.value
    if (next === 'shuffle') {
      baseOrder.value = items.value.map((entry) => entry.key)
      const rest = items.value.filter((entry) => entry.key !== playing?.key)
      shuffleInPlace(rest)
      items.value = playing ? [playing, ...rest] : rest
      pos.value = playing ? 0 : -1
    } else if (mode.value === 'shuffle' && baseOrder.value) {
      const order = new Map(baseOrder.value.map((key, index) => [key, index]))
      items.value = [...items.value].sort(
        (a, b) =>
          (order.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.key) ?? Number.MAX_SAFE_INTEGER),
      )
      pos.value = playing ? items.value.findIndex((entry) => entry.key === playing.key) : -1
      baseOrder.value = null
    }
    mode.value = next
  }

  function cycleMode() {
    const index = playModes.indexOf(mode.value)
    setMode(playModes[(index + 1) % playModes.length])
  }

  function clear() {
    items.value = []
    pos.value = -1
    source.value = ''
    baseOrder.value = null
    open.value = false
  }

  function isCurrent(songId: string) {
    return current.value?.songId === songId
  }

  function restore(userId: number) {
    if (owner === userId && initialized.value) return
    owner = userId
    try {
      const raw = localStorage.getItem(storageKey(userId))
      const data = raw
        ? (JSON.parse(raw) as {
            items?: unknown
            pos?: unknown
            mode?: unknown
            source?: unknown
            base?: unknown
          })
        : null
      if (data && Array.isArray(data.items)) {
        items.value = data.items.filter(isEntry)
        pos.value = typeof data.pos === 'number' && data.pos < items.value.length ? data.pos : -1
        mode.value = playModes.includes(data.mode as PlayMode) ? (data.mode as PlayMode) : 'order'
        source.value = typeof data.source === 'string' ? data.source : ''
        baseOrder.value = Array.isArray(data.base)
          ? data.base.filter((key): key is string => typeof key === 'string')
          : null
      }
    } catch {
      /* 损坏的本地队列直接忽略。 */
    }
    initialized.value = true
  }

  function reset() {
    items.value = []
    pos.value = -1
    source.value = ''
    mode.value = 'order'
    baseOrder.value = null
    open.value = false
    initialized.value = false
    owner = null
  }

  return {
    items,
    pos,
    mode,
    source,
    open,
    current,
    length,
    progress,
    hasPlayable,
    nextEntry,
    playList,
    append,
    insertNext,
    jump,
    removeItem,
    advance,
    previous,
    setMode,
    cycleMode,
    replace,
    clear,
    isCurrent,
    restore,
    reset,
  }
})
