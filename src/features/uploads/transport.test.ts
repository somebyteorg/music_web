import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadEvent } from './machine'

const tus = vi.hoisted(() => {
  class FakeUpload {
    static instances: FakeUpload[] = []
    url = '/upload/tus-1'
    options: Record<string, unknown> & {
      uploadUrl?: string
      onUploadUrlAvailable?: () => void
      onProgress?: (sent: number, total: number) => void
      onSuccess?: () => void
      onError?: (error: Error) => void
      fingerprint?: () => Promise<string>
    }
    aborted = false
    constructor(_file: File, options: never) {
      this.options = options
      FakeUpload.instances.push(this)
    }
    start() {
      this.options.onUploadUrlAvailable?.()
    }
    async abort() {
      this.aborted = true
      this.options.onError?.(new DOMException('aborted', 'AbortError'))
    }
  }
  return { FakeUpload }
})

vi.mock('tus-js-client', () => ({ Upload: tus.FakeUpload }))
vi.mock('@/utils/uploadPreparation', () => ({
  prepareUpload: vi.fn(
    async (
      _file: File,
      _audio: boolean,
      _signal: AbortSignal,
      onMetadata: (metadata: { title: string }) => void,
      onProgress: (progress: number) => void,
    ) => {
      onMetadata({ title: '来自文件的标题' })
      onProgress(100)
      return { sha256: 'sha-1', metadata: { preparedLyrics: [] } }
    },
  ),
}))
vi.mock('./repository', () => ({
  uploadRepository: {
    getSession: vi.fn(),
    createSession: vi.fn(),
    checkDuplicate: vi.fn(),
    retry: vi.fn(),
    publishFile: vi.fn(),
    publishFiles: vi.fn(),
    previewFiles: vi.fn(),
    albumMatches: vi.fn(),
    positions: vi.fn(),
    saveDrafts: vi.fn(),
  },
}))

import { prepareUpload } from '@/utils/uploadPreparation'
import { uploadRepository } from './repository'
import {
  fingerprintOfFile,
  uploadFingerprint,
  resumeUploadUrl,
  createUploadRunner,
} from './transport'
import { reduceTask } from './machine'
import {
  createUploadTask,
  type TaskDraft,
  type TaskMetadata,
  type TaskTransfer,
  type UploadTask,
} from './model'

interface Overrides {
  fingerprint?: string
  transfer?: Partial<TaskTransfer>
  metadata?: Partial<TaskMetadata>
  draft?: Partial<TaskDraft>
}

function task(overrides: Overrides = {}): UploadTask {
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
    ...(overrides.fingerprint ? { fingerprint: overrides.fingerprint } : {}),
    transfer: { ...base.transfer, ...overrides.transfer },
    metadata: { ...base.metadata, ...overrides.metadata },
    draft: { ...base.draft, ...overrides.draft },
  }
}

function setup() {
  const files = new Map<string, File>([['task-1', new File(['abc'], 'a.flac')]])
  const events: UploadEvent[] = []
  const finish = vi.fn()
  const idle = vi.fn()
  const current = task()
  const runner = createUploadRunner({
    userId: () => 1,
    chunkSize: () => 1024,
    tasks: () => [current],
    file: (id) => files.get(id),
    apply: (target, event) => {
      events.push(event)
      Object.assign(target, reduceTask(target, event))
    },
    finish,
    isPublishing: () => false,
    idle,
  })
  return { runner, current, events, finish, idle, files }
}

async function waitInstance() {
  for (let index = 0; index < 100; index++) {
    if (tus.FakeUpload.instances.length) return tus.FakeUpload.instances.at(-1)!
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('tus 未开始')
}

beforeEach(() => {
  tus.FakeUpload.instances = []
  vi.mocked(uploadRepository.getSession)
    .mockReset()
    .mockResolvedValue({
      session: { status: 'processing' },
      file: null,
    })
  vi.mocked(uploadRepository.createSession)
    .mockReset()
    .mockResolvedValue({
      session: { id: 'session-1' },
      token: 'token-1',
      endpoint: '/upload',
    })
  vi.mocked(uploadRepository.checkDuplicate).mockReset().mockResolvedValue({ file: null })
  vi.mocked(prepareUpload).mockClear()
})

describe('transport：tus 传输', () => {
  it('从校验、建会话一路传到 processing，并触发进度回调', async () => {
    const { runner, current, events } = setup()
    const running = runner.run(current)
    const upload = await waitInstance()
    expect(upload.options.uploadUrl).toBeUndefined()
    upload.options.onProgress?.(50, 100)
    upload.options.onSuccess?.()
    await running

    expect(current.state).toBe('processing')
    expect(current.transfer.progress).toBe(100)
    expect(current.transfer.sessionId).toBe('session-1')
    expect(events.map((event) => event.type)).toEqual([
      'started',
      'progress',
      'prepared',
      'checked',
      'sessionCreated',
      'progress',
      'transferred',
    ])
    expect(events).toContainEqual({ type: 'progress', progress: 50 })
    expect(uploadRepository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ file_name: 'a.flac', sha256: 'sha-1' }),
      expect.any(AbortSignal),
    )
  })

  it('恢复已有会话时沿用 uploadUrl 续传，并生成稳定指纹', async () => {
    vi.mocked(uploadRepository.getSession).mockResolvedValue({
      session: { status: 'uploading', tus_id: null },
      file: null,
    })
    const { runner, current } = setup()
    Object.assign(current.transfer, {
      sessionId: 'session-0',
      token: 'token-0',
      endpoint: '/upload',
      uploadUrl: '/upload/tus-0',
      sha256: 'sha-0',
    })
    const running = runner.run(current)
    const upload = await waitInstance()
    expect(upload.options.uploadUrl).toBe('/upload/tus-0')
    await expect(upload.options.fingerprint?.()).resolves.toBe(
      'music:1:session-0:album/a.flac:1024:0',
    )
    upload.options.onSuccess?.()
    await running
    expect(prepareUpload).not.toHaveBeenCalled()
    expect(uploadRepository.createSession).not.toHaveBeenCalled()
  })

  it('暂停会中止 tus，任务停在 paused 而不是 failed', async () => {
    const { runner, current } = setup()
    const running = runner.run(current)
    const upload = await waitInstance()
    await runner.pause(current)
    await running
    expect(upload.aborted).toBe(true)
    expect(current.state).toBe('paused')
  })

  it('tus 失败回调把任务置为 failed 并保留错误信息', async () => {
    const { runner, current } = setup()
    const running = runner.run(current)
    const upload = await waitInstance()
    upload.options.onError?.(new Error('网络中断'))
    await running
    expect(current.state).toBe('failed')
    expect(current.error).toBe('网络中断')
    expect(current.errorStage).toBe('transfer')
  })

  it('没拿到本地文件时直接跳过', async () => {
    const { runner, current, files } = setup()
    files.clear()
    await runner.run(current)
    expect(current.state).toBe('queued')
    expect(tus.FakeUpload.instances).toHaveLength(0)
  })
})

describe('transport：指纹与续传地址', () => {
  it('文件指纹包含路径、大小与修改时间', () => {
    const file = new File(['abc'], 'a.flac', { lastModified: 123 })
    Object.defineProperty(file, 'webkitRelativePath', { value: 'album/a.flac' })
    expect(fingerprintOfFile(file)).toBe('album/a.flac:3:123')
  })

  it('tus 指纹按用户与会话隔离', () => {
    expect(
      uploadFingerprint(7, task({ fingerprint: 'watch', transfer: { sessionId: 's9' } })),
    ).toBe('music:7:s9:watch')
  })

  it('tus_id 会按路径段编码拼回 uploadUrl', () => {
    expect(resumeUploadUrl('/upload/', 'a/b c')).toBe('/upload/a/b%20c')
    expect(resumeUploadUrl(undefined, 'a')).toBeUndefined()
  })
})
