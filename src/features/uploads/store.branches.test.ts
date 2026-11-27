import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import type { AudioFile } from '@/types/uploads'
import type { User } from '@/types/session'
import { isUploadDone } from './model'

const fixtures = vi.hoisted(() => ({
  audioFile: (songId: string | null = null, kind: 'audio' | 'cover' = 'audio') =>
    ({
      id: `file-${kind}`,
      song_id: songId,
      file_name: kind === 'cover' ? 'cover.jpg' : 'a.flac',
      file_size: 3,
      kind,
      quality: 'lossless',
      codec: 'flac',
      sample_rate: 44100,
      bit_depth: 16,
      duration: 100,
      metadata: null,
      upload_context: null,
      upload_draft: null,
    }) as unknown as AudioFile,
}))

vi.mock('tus-js-client', () => ({
  Upload: class {
    url = '/upload/tus-1'
    options: Record<string, unknown> & {
      onProgress?: (sent: number, total: number) => void
      onSuccess?: () => void
      onUploadUrlAvailable?: () => void
    }
    constructor(_file: File, options: never) {
      this.options = options
    }
    start() {
      this.options.onUploadUrlAvailable?.()
      this.options.onProgress?.(100, 100)
      setTimeout(() => this.options.onSuccess?.(), 0)
    }
    async abort() {}
  },
}))
vi.mock('@/utils/uploadPreparation', () => ({
  prepareUpload: async (
    _file: File,
    _audio: boolean,
    _signal: AbortSignal,
    _metadata: unknown,
    onProgress: (progress: number) => void,
  ) => {
    onProgress(100)
    return { sha256: 'sha-1', metadata: { preparedLyrics: [] } }
  },
}))
vi.mock('./repository', () => ({
  uploadRepository: {
    createSession: vi.fn(async () => ({
      session: { id: 'session-1' },
      token: 'token-1',
      endpoint: '/upload',
    })),
    getSession: vi.fn(async () => ({
      session: { status: 'complete' },
      file: fixtures.audioFile(),
    })),
    retry: vi.fn(async () => undefined),
    checkDuplicate: vi.fn(async () => ({ file: null })),
    saveDrafts: vi.fn(),
    publishFile: vi.fn(async () => ({ file: fixtures.audioFile('song-1'), song_id: 'song-1' })),
    publishFiles: vi.fn(async () => ({ items: [] })),
    previewFiles: vi.fn(async () => ({ files: [] })),
    albumMatches: vi.fn(async () => ({ items: [] })),
    albumPositions: vi.fn(async () => ({ items: [] })),
  },
}))

import { uploadRepository } from './repository'
import { useUploadsStore } from '@/stores/uploads'
import { useSignStore } from '@/stores/sign'

const memory = new Map<string, string>()
async function wait(assert: () => void) {
  for (let index = 0; index < 100; index++) {
    try {
      assert()
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  assert()
}

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  })
  Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:x', configurable: true })
  Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true })
  setActivePinia(createPinia())
  const sign = useSignStore()
  sign.user = { id: 1, name: 'u', role: 'user' } as unknown as User
  sign.config = {
    max_file_size: 1e9,
    max_cover_size: 1e6,
    chunk_size: 1e6,
    max_chunk_size: 2e6,
    audio_extensions: ['flac'],
    cover_extensions: ['jpg'],
    quality_labels: {},
    notice: { version: 1, text: '' },
  } as never
  vi.mocked(uploadRepository.checkDuplicate).mockReset().mockResolvedValue({ file: null })
  vi.mocked(uploadRepository.getSession)
    .mockReset()
    .mockResolvedValue({
      session: { status: 'complete' },
      file: fixtures.audioFile(),
    })
})

describe('上传业务分支：查重 / 复用 / 跳过', () => {
  it('查重命中进入 duplicate 并记录已有文件', async () => {
    const existing = fixtures.audioFile()
    vi.mocked(uploadRepository.checkDuplicate).mockResolvedValue({ file: existing })
    const uploads = useUploadsStore()
    await uploads.add([new File(['abc'], 'a.flac')])
    await wait(() => expect(uploads.tasks[0].state).toBe('duplicate'))
    expect(uploads.tasks[0].draft.duplicateFile?.id).toBe(existing.id)
    expect(uploads.duplicateFile(uploads.tasks[0])?.id).toBe(existing.id)
  })

  it('useDuplicate 复用已关联歌曲的文件后直接 published', async () => {
    const existing = fixtures.audioFile('song-1')
    vi.mocked(uploadRepository.checkDuplicate).mockResolvedValue({ file: existing })
    const uploads = useUploadsStore()
    await uploads.add([new File(['abc'], 'a.flac')])
    await wait(() => expect(uploads.tasks[0].state).toBe('duplicate'))
    await uploads.useDuplicate(uploads.tasks[0])
    expect(uploads.tasks[0].state).toBe('published')
    expect(uploads.tasks[0].metadata.songId).toBe('song-1')
    expect(uploads.tasks[0].draft.duplicateFile).toBeUndefined()
  })

  it('skip 把重复任务置为 skipped', async () => {
    vi.mocked(uploadRepository.checkDuplicate).mockResolvedValue({
      file: fixtures.audioFile(),
    })
    const uploads = useUploadsStore()
    await uploads.add([new File(['abc'], 'a.flac')])
    await wait(() => expect(uploads.tasks[0].state).toBe('duplicate'))
    uploads.skip(uploads.tasks[0])
    expect(uploads.tasks[0].state).toBe('skipped')
    expect(isUploadDone(uploads.tasks[0])).toBe(true)
  })
})

describe('上传业务分支：封面与恢复', () => {
  it('封面上传完成后是 ready，并计入已完成', async () => {
    vi.mocked(uploadRepository.getSession).mockResolvedValue({
      session: { status: 'complete' },
      file: fixtures.audioFile(null, 'cover'),
    })
    const uploads = useUploadsStore()
    await uploads.add([new File(['abc'], 'cover.jpg')], { kind: 'cover' })
    await wait(() => expect(uploads.tasks[0].state).toBe('ready'))
    expect(uploads.tasks[0].kind).toBe('cover')
    expect(uploads.tasks[0].transfer.file?.kind).toBe('cover')
    expect(isUploadDone(uploads.tasks[0])).toBe(true)
  })

  it('restart 把 failed 任务清回 queued 并清空会话', async () => {
    const uploads = useUploadsStore()
    const sign = useSignStore()
    await uploads.add([new File(['abc'], 'a.flac')])
    uploads.stop()
    const task = uploads.tasks[0]
    sign.user = null
    await nextTick()
    Object.assign(task, {
      state: 'failed',
      error: '失败',
      errorStage: 'transfer',
    })
    Object.assign(task.transfer, {
      sessionId: 'session-9',
      token: 'token-9',
      uploadUrl: '/upload/tus-9',
      endpoint: '/upload',
      sha256: 'sha-9',
      progress: 40,
    })
    uploads.restart(task)
    expect(task.state).toBe('queued')
    expect(task.transfer.sessionId).toBeUndefined()
    expect(task.transfer.token).toBeUndefined()
    expect(task.transfer.uploadUrl).toBeUndefined()
    expect(task.transfer.sha256).toBeUndefined()
    expect(task.transfer.progress).toBe(0)
    expect(task.error).toBe('')
  })

  it('retryAll 只重试失败项，可选包含暂停项，并返回失败数', async () => {
    const uploads = useUploadsStore()
    const sign = useSignStore()
    await uploads.add([new File(['abc'], 'a.flac'), new File(['def'], 'b.flac')])
    uploads.stop()
    const [failed, paused] = uploads.tasks
    sign.user = null
    await nextTick()
    Object.assign(failed!, { state: 'failed', error: '失败' })
    Object.assign(paused!, { state: 'paused', error: '暂停' })
    failed!.transfer.sessionId = undefined
    paused!.transfer.sessionId = undefined

    expect(await uploads.retryAll([failed!, paused!], true)).toBe(0)
    expect(failed!.state).toBe('queued')
    expect(paused!.state).toBe('paused')

    expect(await uploads.retryAll([failed!, paused!], false)).toBe(0)
    expect(paused!.state).toBe('queued')
  })
})
describe('上传业务分支：刷新后恢复', () => {
  const snapshot = {
    id: 'task-1',
    fingerprint: 'album/a.flac:3:0',
    kind: 'audio',
    state: 'uploading',
    name: 'a.flac',
    size: 3,
    relativePath: 'album/a.flac',
    sessionId: 'session-1',
    token: 'token-1',
    endpoint: '/upload',
    uploadUrl: '/upload/tus-1',
    error: '',
    metadata: { title: 'a', artist: '', album: '', version: '', track: 1, disc: 1 },
    savedAt: 1,
  }

  it('从 localStorage 恢复任务与会话，文件等内存字段不落盘', async () => {
    memory.set('music-upload-tasks-v2', JSON.stringify({ '1': [snapshot] }))
    setActivePinia(createPinia())
    const uploads = useUploadsStore()
    const sign = useSignStore()
    sign.user = { id: 1, name: 'u', role: 'user' } as unknown as User
    await nextTick()
    expect(uploads.tasks).toHaveLength(1)
    const task = uploads.tasks[0]!
    expect(task.state).toBe('paused')
    expect(task.transfer.sessionId).toBe('session-1')
    expect(task.transfer.file).toBeUndefined()
    expect(task.draft).toEqual({})
  })

  it('刷新后继续任务时仍提示重新选择原文件', async () => {
    memory.set('music-upload-tasks-v2', JSON.stringify({ '1': [snapshot] }))
    setActivePinia(createPinia())
    const uploads = useUploadsStore()
    const sign = useSignStore()
    sign.user = { id: 1, name: 'u', role: 'user' } as unknown as User
    await nextTick()
    const task = uploads.tasks[0]!
    vi.mocked(uploadRepository.getSession).mockResolvedValue({
      session: { status: 'uploading' },
      file: null,
    })
    await uploads.retry(task)
    expect(task.state).toBe('paused')
    expect(task.error).toBe('重新选择原文件或原文件夹后，即可继续上传。')
  })

  it('从 v1 迁移后 store 里能看到任务，且已回落 paused', async () => {
    memory.set('music-upload-tasks-v1', JSON.stringify({ '1': [snapshot] }))
    setActivePinia(createPinia())
    const uploads = useUploadsStore()
    const sign = useSignStore()
    sign.user = { id: 1, name: 'u', role: 'user' } as unknown as User
    await nextTick()
    expect(uploads.tasks).toHaveLength(1)
    expect(uploads.tasks[0]!.state).toBe('paused')
    expect(uploads.tasks[0]!.error).toBe('重新选择原文件或原文件夹后，即可继续上传。')
    expect(memory.has('music-upload-tasks-v1')).toBe(false)
  })
})
