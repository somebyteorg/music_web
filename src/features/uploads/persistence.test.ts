import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createUploadTask, type UploadTask } from './model'
import { fromSnapshot, toSnapshot, useUploadPersistence } from './persistence'
import type { UploadTaskSnapshot } from './persistence'
import { notification } from '@/composables/useFeedback'
import type { AudioFile } from '@/types/uploads'

const audioFile = (overrides: Partial<AudioFile> = {}) =>
  ({ id: 'file-1', song_id: null, file_name: 'a.flac', ...overrides }) as AudioFile

function task(): UploadTask {
  const base = createUploadTask({
    id: 'task-1',
    name: 'a.flac',
    size: 1024,
    relativePath: 'album/a.flac',
    fingerprint: 'album/a.flac:1024:0',
    kind: 'audio',
  })
  return {
    ...base,
    state: 'ready',
    error: '重新选择原文件或原文件夹后，即可继续上传。',
    errorStage: 'transfer',
    transfer: {
      progress: 62,
      preparationProgress: 100,
      sha256: 'sha-1',
      preparedLyrics: [
        {
          name: 'a.lrc',
          format: 'lrc',
          kind: 'main',
          language: 'zh',
          source: 'embedded',
          content: '[00:00]一句',
          is_default: true,
          lrc: '[00:00]一句',
          structured: [],
          source_format: 'lrc',
        },
      ],
      sessionId: 'session-1',
      token: 'token-1',
      endpoint: '/upload',
      uploadUrl: '/upload/tus-1',
      file: audioFile(),
      reused: true,
    },
    metadata: {
      ...base.metadata,
      title: '一首歌',
      artist: '歌手',
      album: '专辑',
      duration: 100,
      targetSongId: 'song-9',
      targetSongName: '目标歌曲',
    },
    draft: {
      pendingPublish: { song_id: 'song-1' },
      publicationGroup: 'group-1',
      duplicateOf: 'task-0',
      duplicateFile: audioFile(),
      organizeDraft: { choice: 'track:song-1', coverChoice: 'auto', includeArtwork: true },
    },
  }
}

describe('上传任务持久化快照', () => {
  it('只落可恢复字段，文件、歌词与待入库数据都不落盘', () => {
    const snapshot = toSnapshot(task())
    expect(snapshot).toMatchObject({
      id: 'task-1',
      fingerprint: 'album/a.flac:1024:0',
      kind: 'audio',
      state: 'ready',
      name: 'a.flac',
      size: 1024,
      relativePath: 'album/a.flac',
      sessionId: 'session-1',
      token: 'token-1',
      endpoint: '/upload',
      uploadUrl: '/upload/tus-1',
      error: '重新选择原文件或原文件夹后，即可继续上传。',
      errorStage: 'transfer',
    })
    const text = JSON.stringify(snapshot)
    for (const key of [
      'file',
      'preparedLyrics',
      'pendingPublish',
      'duplicateFile',
      'duplicateOf',
      'organizeDraft',
      'publicationGroup',
      'progress',
      'sha256',
      'reused',
    ])
      expect(text).not.toContain(`"${key}"`)
  })

  it('恢复后只保留可恢复字段，内存字段回到初始值', () => {
    const restored = fromSnapshot(toSnapshot(task()))
    expect(restored.transfer).toEqual({
      progress: 0,
      sessionId: 'session-1',
      token: 'token-1',
      endpoint: '/upload',
      uploadUrl: '/upload/tus-1',
    })
    expect(restored.draft).toEqual({})
    expect(restored.metadata).toMatchObject({
      title: '一首歌',
      artist: '歌手',
      album: '专辑',
      duration: 100,
      targetSongId: 'song-9',
      targetSongName: '目标歌曲',
    })
    expect(restored.error).toBe('重新选择原文件或原文件夹后，即可继续上传。')
    expect(restored.errorStage).toBe('transfer')
  })

  it('快照可以 JSON 往返', () => {
    const restored = fromSnapshot(JSON.parse(JSON.stringify(toSnapshot(task()))))
    expect(restored).toEqual(fromSnapshot(toSnapshot(task())))
  })
})

const LEGACY_KEY = 'music-upload-tasks-v1'
const SNAPSHOT_KEY = 'music-upload-tasks-v2'
const HINT = '重新选择原文件或原文件夹后，即可继续上传。'

const memory = new Map<string, string>()

beforeEach(() => {
  vi.useFakeTimers()
  memory.clear()
  notification.value = null
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** v1 存的是整份 UploadTask：file 落盘后被 JSON 序列化成 {}，草稿也整份存着 */
function legacyTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'legacy-1',
    fingerprint: 'album/a.flac:1024:0',
    kind: 'audio',
    state: 'uploading',
    name: 'a.flac',
    size: 1024,
    relativePath: 'album/a.flac',
    batchId: 'batch-1',
    error: '',
    errorStage: 'transfer',
    transfer: {
      progress: 42,
      preparationProgress: 100,
      sha256: 'sha-1',
      preparedLyrics: [{ name: 'a.lrc', format: 'lrc', content: '[00:00]一句' }],
      sessionId: 'session-legacy',
      token: 'token-legacy',
      endpoint: '/upload',
      uploadUrl: '/upload/tus-legacy',
      file: {},
      reused: false,
    },
    metadata: { title: '一首歌', artist: '歌手', album: '专辑', track: 2, disc: 1, duration: 100 },
    draft: { pendingPublish: { song_id: 'song-1' }, duplicateFile: {}, organizeDraft: {} },
    ...overrides,
  }
}

function legacyStore(tasks: unknown) {
  memory.set(LEGACY_KEY, JSON.stringify(tasks))
}

function storedSnapshots() {
  return JSON.parse(memory.get(SNAPSHOT_KEY) ?? '{}') as Record<string, UploadTaskSnapshot[]>
}

describe('上传任务存储 v1 → v2 迁移', () => {
  it('正常迁移：v1 任务变成 v2 快照，会话凭据保留、任务可读', () => {
    legacyStore({ '1': [legacyTask()] })
    const storage = useUploadPersistence()
    expect(storage.list(1)).toHaveLength(1)
    expect(storage.list(1)[0]).toMatchObject({
      id: 'legacy-1',
      kind: 'audio',
      state: 'paused',
      name: 'a.flac',
      size: 1024,
      relativePath: 'album/a.flac',
      batchId: 'batch-1',
      error: HINT,
      errorStage: 'transfer',
      transfer: {
        progress: 0,
        sessionId: 'session-legacy',
        token: 'token-legacy',
        endpoint: '/upload',
        uploadUrl: '/upload/tus-legacy',
      },
      metadata: { title: '一首歌', artist: '歌手', album: '专辑', track: 2, duration: 100 },
      draft: {},
    })
    expect(memory.has(LEGACY_KEY)).toBe(false)
  })

  it('字段裁剪：文件、objectURL、duplicateFile 与整份 draft 都不进 v2', () => {
    legacyStore({ '1': [legacyTask({ objectURL: 'blob:legacy' })] })
    useUploadPersistence()
    const text = JSON.stringify(storedSnapshots()['1'])
    for (const key of [
      'file',
      'objectURL',
      'duplicateFile',
      'pendingPublish',
      'organizeDraft',
      'draft',
      'progress',
      'sha256',
      'preparedLyrics',
      'reused',
    ])
      expect(text).not.toContain(`"${key}"`)
  })

  it('状态归一：需要本地文件的状态回落 paused 并提示重选，其余状态不变', () => {
    const states = ['queued', 'preparing', 'checking', 'uploading', 'processing', 'ready', 'failed']
    legacyStore({
      '1': states.map((state, index) =>
        legacyTask({ id: `legacy-${index}`, state, error: state === 'failed' ? '服务端失败' : '' }),
      ),
    })
    const tasks = useUploadPersistence().list(1)
    expect(tasks.slice(0, 4).map((task) => [task.state, task.error])).toEqual(
      Array(4).fill(['paused', HINT]),
    )
    expect(tasks.slice(4).map((task) => task.state)).toEqual(['processing', 'ready', 'failed'])
    expect(tasks[6]!.error).toBe('服务端失败')
  })

  it('幂等：重复初始化不重复迁移，迁移后 v1 已删除', async () => {
    legacyStore({ '1': [legacyTask()] })
    const first = useUploadPersistence()
    await nextTick()
    const second = useUploadPersistence()
    await nextTick()
    expect(first.list(1).map((task) => task.id)).toEqual(['legacy-1'])
    expect(second.list(1).map((task) => task.id)).toEqual(['legacy-1'])
    expect(storedSnapshots()['1']).toHaveLength(1)
    expect(memory.has(LEGACY_KEY)).toBe(false)
  })

  it('v2 已有数据时以 v2 为准，残留的 v1 被清掉而不是覆盖', () => {
    memory.set(SNAPSHOT_KEY, JSON.stringify({ '1': [toSnapshot(task())] }))
    legacyStore({ '1': [legacyTask()] })
    const storage = useUploadPersistence()
    expect(storage.list(1).map((entry) => entry.id)).toEqual(['task-1'])
    expect(memory.has(LEGACY_KEY)).toBe(false)
  })

  it('坏数据（不是 JSON）不删 v1，并报告可读错误', () => {
    memory.set(LEGACY_KEY, '{ 不是 JSON')
    const storage = useUploadPersistence()
    expect(storage.everyone()).toEqual([])
    expect(memory.get(LEGACY_KEY)).toBe('{ 不是 JSON')
    expect(notification.value).toMatchObject({ error: true })
    expect(notification.value?.text).toContain('迁移失败')
    expect(notification.value?.text).toContain('已保留原数据')
  })

  it('坏数据（结构不合规）同样保留 v1，并指出坏在哪一条', () => {
    const broken = JSON.stringify({ '1': [{ id: 'legacy-1' }] })
    memory.set(LEGACY_KEY, broken)
    useUploadPersistence()
    expect(memory.get(LEGACY_KEY)).toBe(broken)
    expect(memory.get(SNAPSHOT_KEY)).toBe('{}')
    expect(notification.value?.text).toContain('用户 1 的第 1 个任务')
  })
})
