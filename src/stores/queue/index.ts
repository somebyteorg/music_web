import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { Entity } from '@/types/catalog'
import { QUEUE_LIMIT, entryFromSong, playModes, type PlayMode, type QueueEntry } from './types'
import { loadSnapshot, saveSnapshot } from './persist'
import {
  nextPosition,
  previousPosition,
  restoreBaseOrder,
  shuffleAround,
  shuffleRest,
} from './shuffle'

export { QUEUE_LIMIT, entryFromSong, playModeLabels, playModes } from './types'
export type { PlayMode, QueueEntry } from './types'

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
    saveSnapshot(owner, items.value, pos.value, mode.value, source.value, baseOrder.value)
  }

  watch([items, pos, mode, source], save, { deep: true })

  /** 用一份列表整体替换队列；start 为点击处下标。 */
  function replace(next: QueueEntry[], start: number, label = '') {
    const trimmed = next.length > QUEUE_LIMIT ? next.slice(0, QUEUE_LIMIT) : next
    items.value = trimmed
    pos.value = trimmed.length ? Math.min(Math.max(start, 0), trimmed.length - 1) : -1
    source.value = label
    baseOrder.value = null
    if (mode.value === 'shuffle' && pos.value >= 0)
      items.value = shuffleRest(items.value, pos.value)
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
    const merged = [...items.value.slice(0, at), ...added, ...items.value.slice(at)]
    items.value = merged.slice(0, QUEUE_LIMIT)
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
    const next = nextPosition(items.value.length, pos.value, mode.value, auto)
    if (next === null) return null
    pos.value = next
    return current.value
  }

  function previous(): QueueEntry | null {
    if (!items.value.length) return null
    pos.value = previousPosition(items.value.length, pos.value, mode.value)
    return current.value
  }

  function setMode(next: PlayMode) {
    if (next === mode.value) return
    const playing = current.value
    if (next === 'shuffle') {
      baseOrder.value = items.value.map((entry) => entry.key)
      items.value = shuffleAround(items.value, playing)
      pos.value = playing ? 0 : -1
    } else if (mode.value === 'shuffle' && baseOrder.value) {
      items.value = restoreBaseOrder(items.value, baseOrder.value)
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
    const snapshot = loadSnapshot(userId)
    if (snapshot) {
      items.value = snapshot.items
      pos.value = snapshot.pos
      mode.value = snapshot.mode
      source.value = snapshot.source
      baseOrder.value = snapshot.base
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
