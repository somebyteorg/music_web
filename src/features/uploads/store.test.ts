import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AudioFile } from '@/types/uploads'
import type { User } from '@/types/session'

const fixtures = vi.hoisted(() => ({
  audioFile: (songId: string | null = null) =>
    ({
      id: 'file-1',
      song_id: songId,
      file_name: 'a.flac',
      file_size: 3,
      kind: 'audio',
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
      this.options.onProgress?.(50, 100)
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
    retrySession: vi.fn(async () => undefined),
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
  for (let i = 0; i < 100; i++) {
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
})

describe('上传任务编排冒烟', () => {
  it('从入队一路走到待确认', async () => {
    const uploads = useUploadsStore()
    const skipped = await uploads.add([new File(['abc'], 'a.flac')])
    expect(skipped).toBe(0)
    await wait(() => expect(uploads.tasks[0].state).toBe('ready'))
    const task = uploads.tasks[0]
    expect(task.file?.id).toBe('file-1')
    expect(task.progress).toBe(100)
    expect(task.sessionId).toBe('session-1')
    expect(vi.mocked(uploadRepository.getSession)).toHaveBeenCalledWith('session-1')
  })

  it('待确认任务可以发布并变成已完成', async () => {
    const uploads = useUploadsStore()
    await uploads.add([new File(['abc'], 'a.flac')])
    await wait(() => expect(uploads.tasks[0].state).toBe('ready'))
    await uploads.publish(uploads.tasks[0], { song_id: 'song-1' })
    expect(uploads.tasks[0].state).toBe('published')
    expect(uploads.tasks[0].songId).toBe('song-1')
    expect(vi.mocked(uploadRepository.publishFile)).toHaveBeenCalled()
  })

  it('入队后可以暂停再继续', async () => {
    const uploads = useUploadsStore()
    await uploads.add([new File(['abc'], 'a.flac')])
    const task = uploads.tasks[0]
    await uploads.pause(task)
    expect(task.state).toBe('paused')
    await uploads.retry(task)
    await wait(() => expect(task.state).toBe('ready'))
  })
})