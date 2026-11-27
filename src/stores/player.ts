import { computed, ref } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { defineStore } from 'pinia'
import { useSignStore } from './sign'
import { entryFromSong, useQueueStore, type QueueEntry } from './queue'
import { report } from '@/composables/useFeedback'
import type { AudioFile } from '@/types/uploads'
import type { Entity } from '@/types/catalog'
import { fileUrl } from '@/utils/file'

const MAX_AUTO_SKIP = 3

export const usePlayerStore = defineStore('player', () => {
  const sign = useSignStore()
  const queue = useQueueStore()
  const audio = new Audio()
  const file = ref<AudioFile | null>(null)
  const song = ref<Entity | null>(null)
  const entryKey = ref<string | null>(null)
  const playing = ref(false)
  const loading = ref(false)
  const time = ref(0)
  const length = ref(0)
  const volume = ref(0.8)
  const collapsed = ref(false)
  const available = computed(() => !!file.value)
  let failures = 0

  audio.preload = 'metadata'
  audio.addEventListener('timeupdate', () => (time.value = audio.currentTime))
  audio.addEventListener(
    'durationchange',
    () => (length.value = Number.isFinite(audio.duration) ? audio.duration : 0),
  )
  audio.addEventListener('play', () => (playing.value = true))
  audio.addEventListener('pause', () => (playing.value = false))
  audio.addEventListener('error', () => {
    playing.value = false
    if (!file.value) return
    report(new Error('这份音频无法播放，已尝试下一首。'))
    void skipBroken()
  })
  audio.addEventListener('ended', () => {
    const next = queue.advance(true)
    if (!next) {
      playing.value = false
      return
    }
    if (next.key === entryKey.value) {
      audio.currentTime = 0
      void audio.play()
      return
    }
    void playEntry(next)
  })

  function supported(f: AudioFile) {
    return !!audio.canPlayType(f.mime_type)
  }

  /** 按用户音质偏好挑文件；入参可能是残缺载荷，函数本身保证不抛错 */
  function pickFile(full: Entity | null | undefined): AudioFile | null {
    if (!full) return null
    const files = full.files
    if (!files?.length) return null
    const quality = sign.user?.quality
    return (
      files.find((item) => item.quality === quality && item.is_default) ||
      files.find((item) => item.quality === quality) ||
      files.find((item) => item.is_default) ||
      files[0] ||
      null
    )
  }

  function updateSession(target: Entity) {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: target.name,
      artist: target.artists?.map((artist) => artist.name).join(' / ') || '跃律',
      album: target.albums?.[0]?.name || '',
    })
  }

  async function start(f: AudioFile, target: Entity, key: string | null) {
    audio.pause()
    file.value = f
    song.value = target
    entryKey.value = key
    time.value = 0
    length.value = f.duration
    audio.src = fileUrl(f.id)
    audio.volume = volume.value
    updateSession(target)
    try {
      await audio.play()
    } catch (e) {
      report(e)
    }
  }

  /** 依次尝试队列里的下一首，连续失败超过阈值就停下，避免整队空转。 */
  async function skipBroken() {
    if (failures >= MAX_AUTO_SKIP) {
      failures = 0
      playing.value = false
      return
    }
    failures += 1
    const next = queue.advance(true)
    if (!next || next.key === entryKey.value) {
      playing.value = false
      return
    }
    await playEntry(next)
  }

  async function playEntry(entry: QueueEntry | null) {
    if (!entry) return
    if (!entry.playable) {
      await skipBroken()
      return
    }
    loading.value = true
    try {
      const cached = song.value
      const full =
        cached && cached.id === entry.songId && cached.files?.length
          ? cached
          : (await catalogApi.item('songs', entry.songId)).item
      // 详情接口异常（例如返回空对象）时给出可读提示
      if (!full) throw new Error('歌曲信息加载失败，请检查网络或稍后重试。')
      const selected = pickFile(full)
      if (!selected) throw new Error('这首歌还没有音频，请先上传。')
      if (!supported(selected))
        throw new Error(`浏览器无法播放 ${selected.codec.toUpperCase()} 格式，已跳过。`)
      await start(selected, full, entry.key)
      failures = 0
    } catch (e) {
      report(e)
      await skipBroken()
    } finally {
      loading.value = false
    }
  }

  /** 用一份歌曲列表整体替换队列，并从这个下标开始播放。 */
  async function playList(items: Entity[], start = 0, label = '') {
    const entry = queue.playList(items, start, label)
    if (!entry) {
      report(new Error('这份列表里还没有可以播放的歌曲。'))
      return
    }
    await playEntry(entry)
  }

  /** 播放指定的音频文件（详情页的资源列表用）。 */
  async function play(f: AudioFile, target: Entity) {
    if (file.value?.id === f.id) {
      await toggle()
      return
    }
    if (queue.current?.songId !== target.id) queue.replace([entryFromSong(target, 0)], 0, '单曲')
    await start(f, target, queue.current?.key ?? null)
  }

  async function resume() {
    if (file.value) {
      try {
        await audio.play()
      } catch (e) {
        report(e)
      }
      return
    }
    await playEntry(queue.current)
  }

  async function toggle() {
    if (!file.value) {
      await resume()
      return
    }
    if (playing.value) audio.pause()
    else {
      try {
        await audio.play()
      } catch (e) {
        report(e)
      }
    }
  }

  async function next() {
    const entry = queue.advance(false)
    if (entry) await playEntry(entry)
  }

  async function previous() {
    const entry = queue.previous()
    if (entry) await playEntry(entry)
  }

  function seek(value: number) {
    if (Number.isFinite(value))
      audio.currentTime = Math.min(Math.max(value, 0), length.value || value)
  }

  function setVolume(value: number) {
    volume.value = value
    audio.volume = value
  }

  function close() {
    file.value = null
    song.value = null
    entryKey.value = null
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    time.value = 0
    length.value = 0
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => void resume())
    navigator.mediaSession.setActionHandler('pause', () => audio.pause())
    navigator.mediaSession.setActionHandler('seekto', (d) => seek(d.seekTime || 0))
    navigator.mediaSession.setActionHandler('seekbackward', () => seek(time.value - 10))
    navigator.mediaSession.setActionHandler('seekforward', () => seek(time.value + 10))
    navigator.mediaSession.setActionHandler('nexttrack', () => void next())
    navigator.mediaSession.setActionHandler('previoustrack', () => void previous())
  }

  return {
    file,
    song,
    entryKey,
    playing,
    loading,
    time,
    length,
    volume,
    collapsed,
    available,
    play,
    playList,
    playEntry,
    resume,
    toggle,
    next,
    previous,
    seek,
    setVolume,
    close,
    supported,
  }
})
