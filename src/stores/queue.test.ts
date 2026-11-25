import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useQueueStore } from './queue'
import type { Entity } from '@/types/catalog'

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

const list = (n: number, playable = true) =>
  Array.from({ length: n }, (_, i) => song(i + 1, playable))

const flush = async () => {
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

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
  it('按点击位置定位，并记录来源与进度', () => {
    const queue = useQueueStore()
    queue.playList(list(5), 2, '专辑')
    expect(queue.current?.songId).toBe('song-3')
    expect(queue.progress).toBe('3 / 5')
    expect(queue.source).toBe('专辑')
  })

  it('顺序播放推进到队尾后返回 null', () => {
    const queue = useQueueStore()
    queue.playList(list(3), 0)
    expect(queue.advance(true)?.songId).toBe('song-2')
    expect(queue.advance(true)?.songId).toBe('song-3')
    expect(queue.advance(true)).toBeNull()
    expect(queue.current?.songId).toBe('song-3')
  })

  it('列表循环从队尾回到队首', () => {
    const queue = useQueueStore()
    queue.playList(list(3), 2)
    queue.setMode('repeat-all')
    expect(queue.advance(true)?.songId).toBe('song-1')
  })

  it('单曲循环始终返回当前曲', () => {
    const queue = useQueueStore()
    queue.playList(list(3), 1)
    queue.setMode('repeat-one')
    expect(queue.advance(true)?.songId).toBe('song-2')
    expect(queue.current?.songId).toBe('song-2')
  })

  it('随机播放保持当前曲在首位，关闭随机能恢复原顺序', () => {
    const queue = useQueueStore()
    queue.playList(list(5), 1)
    queue.setMode('shuffle')
    expect(queue.current?.songId).toBe('song-2')
    expect(new Set(queue.items.map((item) => item.songId)).size).toBe(5)
    queue.setMode('order')
    expect(queue.items.map((item) => item.songId)).toEqual([
      'song-1',
      'song-2',
      'song-3',
      'song-4',
      'song-5',
    ])
    expect(queue.current?.songId).toBe('song-2')
  })

  it('追加与下一首插队位置正确', () => {
    const queue = useQueueStore()
    queue.playList(list(3), 0)
    queue.append([song(8)])
    expect(queue.length).toBe(4)
    queue.insertNext([song(9)])
    expect(queue.items[queue.pos + 1]?.songId).toBe('song-9')
  })

  it('移除其它曲目不影响当前曲，删空后 current 为 null', () => {
    const queue = useQueueStore()
    queue.playList(list(3), 1)
    queue.removeItem(queue.items[0].key)
    expect(queue.current?.songId).toBe('song-2')
    expect(queue.length).toBe(2)
    queue.clear()
    expect(queue.current).toBeNull()
    expect(queue.length).toBe(0)
  })

  it('跳过没有音频的曲目', () => {
    const queue = useQueueStore()
    const picked = queue.playList([song(1, false), song(2), song(3)], 0)
    expect(picked?.songId).toBe('song-2')
  })

  it('按用户持久化，重新恢复后状态一致', async () => {
    const queue = useQueueStore()
    queue.restore(7)
    queue.playList(list(4), 2, '歌单')
    queue.setMode('shuffle')
    await flush()
    const saved = JSON.parse(memory.get('music.queue.v1.7') ?? '{}')
    expect(saved.items).toHaveLength(4)
    expect(saved.source).toBe('歌单')

    queue.reset()
    expect(queue.length).toBe(0)
    queue.restore(7)
    expect(queue.length).toBe(4)
    expect(queue.mode).toBe('shuffle')
    expect(queue.source).toBe('歌单')
  })

  it('不同用户之间不共享队列', async () => {
    const queue = useQueueStore()
    queue.restore(1)
    queue.playList(list(2), 0)
    await flush()
    queue.reset()
    queue.restore(2)
    expect(queue.length).toBe(0)
  })
})
