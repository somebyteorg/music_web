import { describe, expect, it } from 'vitest'
import { reduceTask } from './machine'
import { createUploadTask, type UploadState, type UploadTask } from './model'
import type { AudioFile } from '@/types/uploads'

const audioFile = (overrides: Partial<AudioFile> = {}) =>
  ({ id: 'file-1', song_id: null, file_name: 'a.flac', ...overrides }) as AudioFile

function task(overrides: Partial<UploadTask> = {}): UploadTask {
  return {
    ...createUploadTask({
      id: 'task-1',
      name: 'a.flac',
      size: 1024,
      relativePath: 'album/a.flac',
      fingerprint: 'album/a.flac:1024:0',
      kind: 'audio',
    }),
    ...overrides,
  }
}

function at(state: UploadState, overrides: Partial<UploadTask> = {}) {
  return task({ state, ...overrides })
}

describe('上传任务状态机：入口与校验', () => {
  it('queued 收到 started 进入校验，并清掉旧错误', () => {
    const next = reduceTask(at('queued', { error: '旧错误', progress: 30 }), { type: 'started' })
    expect(next.state).toBe('preparing')
    expect(next.error).toBe('')
    expect(next.errorStage).toBe('preparation')
    expect(next.progress).toBe(0)
  })

  it('preparing 收到 prepared 进入查重，并记录校验结果', () => {
    const next = reduceTask(at('preparing', { preparationProgress: 40 }), {
      type: 'prepared',
      sha256: 'sha-1',
      preparedLyrics: [],
    })
    expect(next.state).toBe('checking')
    expect(next.sha256).toBe('sha-1')
    expect(next.preparedLyrics).toEqual([])
    expect(next.preparationProgress).toBe(100)
  })

  it('查重不重复时停留在 checking，等待建会话', () => {
    const next = reduceTask(at('checking', { error: 'x' }), { type: 'checked', duplicate: false })
    expect(next.state).toBe('checking')
    expect(next.error).toBe('')
  })

  it('查重命中时进入 duplicate 并记录重复来源', () => {
    const file = audioFile()
    const next = reduceTask(at('checking'), {
      type: 'checked',
      duplicate: true,
      duplicateOf: 'task-0',
      duplicateFile: file,
    })
    expect(next.state).toBe('duplicate')
    expect(next.duplicateOf).toBe('task-0')
    expect(next.duplicateFile).toBe(file)
  })

  it('sessionCreated 进入上传中并写入会话凭据', () => {
    const next = reduceTask(at('checking'), {
      type: 'sessionCreated',
      sessionId: 's1',
      token: 'tok',
      endpoint: '/upload',
    })
    expect(next.state).toBe('uploading')
    expect(next.sessionId).toBe('s1')
    expect(next.token).toBe('tok')
    expect(next.endpoint).toBe('/upload')
    expect(next.errorStage).toBe('transfer')
  })

  it('恢复已有会话时也可以从 preparing 直接进入上传中', () => {
    const next = reduceTask(at('preparing', { sessionId: 's0' }), {
      type: 'sessionCreated',
      sessionId: 's0',
      uploadUrl: '/upload/s0',
    })
    expect(next.state).toBe('uploading')
    expect(next.uploadUrl).toBe('/upload/s0')
  })
})

describe('上传任务状态机：会话恢复与入库入口', () => {
  it('暂停中的任务发现服务端已在解析，进入 processing', () => {
    const next = reduceTask(at('paused'), { type: 'sessionRestored' })
    expect(next.state).toBe('processing')
    expect(next.error).toBe('')
    expect(next.errorStage).toBe('processing')
  })

  it('服务端返回入库中时进入 publishing', () => {
    const next = reduceTask(at('processing'), { type: 'sessionRestored', status: 'publishing' })
    expect(next.state).toBe('publishing')
    expect(next.errorStage).toBe('publishing')
  })

  it('sessionRestored 不会把上传中的任务直接拉进服务端阶段', () => {
    const source = at('uploading')
    expect(reduceTask(source, { type: 'sessionRestored' })).toBe(source)
  })

  it('ready 与 duplicate 可以开始入库', () => {
    expect(reduceTask(at('ready'), { type: 'publishingStarted' }).state).toBe('publishing')
    expect(reduceTask(at('duplicate'), { type: 'publishingStarted' }).state).toBe('publishing')
  })

  it('processing 不能直接开始入库', () => {
    const source = at('processing')
    expect(reduceTask(source, { type: 'publishingStarted' })).toBe(source)
  })
})

describe('上传任务状态机：传输进度', () => {
  it('校验进度会被夹到 0..100', () => {
    expect(
      reduceTask(at('preparing'), { type: 'progress', preparationProgress: 150 })
        .preparationProgress,
    ).toBe(100)
    expect(
      reduceTask(at('preparing'), { type: 'progress', preparationProgress: -3 })
        .preparationProgress,
    ).toBe(0)
  })

  it('传输进度四舍五入', () => {
    expect(reduceTask(at('uploading'), { type: 'progress', progress: 42.6 }).progress).toBe(43)
  })

  it('非传输状态忽略进度事件', () => {
    const source = at('processing', { progress: 10 })
    expect(reduceTask(source, { type: 'progress', progress: 90 })).toBe(source)
  })

  it('只有 uploading 能 transferred 进入解析，并补满进度', () => {
    const next = reduceTask(at('uploading', { progress: 60 }), { type: 'transferred' })
    expect(next.state).toBe('processing')
    expect(next.progress).toBe(100)
    expect(next.errorStage).toBe('processing')
    const source = at('ready')
    expect(reduceTask(source, { type: 'transferred' })).toBe(source)
  })
})

describe('上传任务状态机：完成与入库', () => {
  it('解析完成但未关联歌曲时回到待确认', () => {
    const next = reduceTask(at('processing', { file: audioFile(), token: 'tok' }), {
      type: 'processed',
    })
    expect(next.state).toBe('ready')
    expect(next.progress).toBe(100)
    expect(next.token).toBeUndefined()
    expect(next.error).toBe('')
  })

  it('解析完成且已关联歌曲时直接发布', () => {
    const next = reduceTask(at('processing', { file: audioFile({ song_id: 'song-1' }) }), {
      type: 'processed',
    })
    expect(next.state).toBe('published')
    expect(next.songId).toBe('song-1')
  })

  it('processed 只接受 processing / publishing，其他来源原样返回', () => {
    for (const state of [
      'ready',
      'duplicate',
      'paused',
      'failed',
      'queued',
      'uploading',
    ] as const) {
      const source = at(state, { file: audioFile() })
      expect(reduceTask(source, { type: 'processed' })).toBe(source)
    }
  })

  it('没有文件时 processed 无效果', () => {
    const source = at('processing')
    expect(reduceTask(source, { type: 'processed' })).toBe(source)
  })

  it('复用已有文件从 duplicate 直接完成', () => {
    const next = reduceTask(at('duplicate', { kind: 'cover', file: audioFile() }), {
      type: 'reused',
    })
    expect(next.state).toBe('ready')
    expect(next.duplicateFile).toBeUndefined()
  })

  it('复用已有文件且文件已关联歌曲时进入 published', () => {
    const next = reduceTask(at('duplicate', { file: audioFile({ song_id: 'song-1' }) }), {
      type: 'reused',
    })
    expect(next.state).toBe('published')
    expect(next.songId).toBe('song-1')
  })

  it('reused 不接受 queued 等未就绪状态', () => {
    const source = at('queued', { file: audioFile() })
    expect(reduceTask(source, { type: 'reused' })).toBe(source)
  })

  it('published 事件清掉待入库数据', () => {
    const next = reduceTask(
      at('publishing', { pendingPublish: { song_id: 'song-1' }, token: 'tok' }),
      { type: 'published', file: audioFile({ song_id: 'song-1' }), songId: 'song-1' },
    )
    expect(next.state).toBe('published')
    expect(next.pendingPublish).toBeUndefined()
    expect(next.songId).toBe('song-1')
  })

  it('skipped 不能被 published 拉起', () => {
    const source = at('skipped')
    expect(reduceTask(source, { type: 'published', songId: 's' })).toBe(source)
  })
})
