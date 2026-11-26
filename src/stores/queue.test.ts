import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { Entity } from '@/types/catalog'
import { useQueueStore } from './queue'

const memory = new Map<string, string>()
const song = (i: number, playable = true) =>
  ({
    id: 'song-' + i,
    name: '歌曲 ' + i,
    artists: [{ id: 'a', name: '歌手' }],
    albums: [{ id: 'b', name: '专辑', cover_id: null, image_url: null }],
    files_count: playable ? 1 : 0,
    duration: 200,
    available: playable,
  }) as unknown as Entity
const list = (n: number) => Array.from({ length: n }, (_, i) => song(i + 1))

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  })
  setActivePinia(createPinia())
})

describe('播放队列', () => {
  it('按点击位置定位并记录来源', () => {
    const queue = useQueueStore()
    queue.playList(list(5), 2, '专辑')
    expect(queue.current?.songId).toBe('song-3')
    expect(queue.progress).toBe('3 / 5')
    expect(queue.source).toBe('专辑')
  })

  it('顺序模式到队尾后返回 null', () => {
    const queue = useQueueStore()
    queue.playList(list(3), 0)
    expect(queue.advance(true)?.songId).toBe('song-2')
    queue.advance(true)
    expect(queue.advance(true)).toBeNull()
  })

  it('列表循环回到队首，单曲循环停在当前', () => {
    const queue = useQueueStore()
    queue.playList(list(3), 2)
    queue.setMode('repeat-all')
    expect(queue.advance(true)?.songId).toBe('song-1')
    queue.setMode('repeat-one')
    expect(queue.advance(true)?.songId).toBe('song-1')
  })

  it('随机保持当前曲在首位，关闭随机恢复原顺序', () => {
    const queue = useQueueStore()
    queue.playList(list(5), 1)
    queue.setMode('shuffle')
    expect(queue.current?.songId).toBe('song-2')
    queue.setMode('order')
    expect(queue.items.map((item) => item.songId)).toEqual([
      'song-1',
      'song-2',
      'song-3',
      'song-4',
      'song-5',
    ])
  })

  it('跳过没有音频的曲目', () => {
    const queue = useQueueStore()
    expect(queue.playList([song(1, false), song(2)], 0)?.songId).toBe('song-2')
  })

  it('按用户持久化并在恢复后一致', async () => {
    const queue = useQueueStore()
    queue.restore(7)
    queue.playList(list(4), 2, '歌单')
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    queue.reset()
    queue.restore(7)
    expect(queue.length).toBe(4)
    expect(queue.source).toBe('歌单')
  })
})
