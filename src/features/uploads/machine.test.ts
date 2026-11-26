import { describe, expect, it } from 'vitest'
import { reduceTask, type UploadEvent } from './machine'
import { createUploadTask, UPLOAD_STATES, type UploadState, type UploadTask } from './model'
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

const EVENTS: UploadEvent[] = [
  { type: 'started' },
  { type: 'prepared', sha256: 'abc' },
  { type: 'checked', duplicate: true },
  { type: 'checked', duplicate: false },
  { type: 'sessionCreated', sessionId: 's1', token: 't1', endpoint: '/upload' },
  { type: 'progress', progress: 50, preparationProgress: 50 },
  { type: 'transferred' },
  { type: 'transferred', status: 'publishing' },
  { type: 'processed' },
  { type: 'published' },
  { type: 'failed', stage: 'transfer', error: 'boom' },
  { type: 'paused' },
  { type: 'resumed' },
  { type: 'retried' },
  { type: 'skipped' },
  { type: 'reset' },
]

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

  it('非法迁移原样返回同一个引用', () => {
    const source = at('preparing')
    expect(reduceTask(source, { type: 'started' })).toBe(source)
    expect(reduceTask(at('queued'), { type: 'prepared' })).not.toMatchObject({ state: 'checking' })
    const uploading = at('uploading')
    expect(reduceTask(uploading, { type: 'checked', duplicate: true })).toBe(uploading)
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

  it('传输完成进入解析并补满进度', () => {
    const next = reduceTask(at('uploading', { progress: 60 }), { type: 'transferred' })
    expect(next.state).toBe('processing')
    expect(next.progress).toBe(100)
    expect(next.errorStage).toBe('processing')
  })

  it('服务端已入库时进入入库中', () => {
    const next = reduceTask(at('ready'), { type: 'transferred', status: 'publishing' })
    expect(next.state).toBe('publishing')
    expect(next.errorStage).toBe('publishing')
  })

  it('已完成任务不会再被 transferred 拉回处理中', () => {
    const source = at('published')
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

  it('封面重复且直接复用已有文件时可以从 duplicate 完成', () => {
    const file = audioFile()
    const next = reduceTask(at('duplicate', { kind: 'cover', file }), { type: 'processed' })
    expect(next.state).toBe('ready')
    expect(next.duplicateFile).toBeUndefined()
  })

  it('没有文件时 processed 无效果', () => {
    const source = at('processing')
    expect(reduceTask(source, { type: 'processed' })).toBe(source)
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

  it('跳过与发布都是终态，不能被 published 从 skipped 拉起', () => {
    const source = at('skipped')
    expect(reduceTask(source, { type: 'published', songId: 's' })).toBe(source)
  })
})

describe('上传任务状态机：失败', () => {
  it('传输失败进入 failed 并记录阶段', () => {
    const next = reduceTask(at('uploading'), { type: 'failed', stage: 'transfer', error: '断网' })
    expect(next.state).toBe('failed')
    expect(next.errorStage).toBe('transfer')
    expect(next.error).toBe('断网')
  })

  it('解析失败进入 failed', () => {
    const next = reduceTask(at('processing'), {
      type: 'failed',
      stage: 'processing',
      error: '解析失败',
    })
    expect(next.state).toBe('failed')
    expect(next.errorStage).toBe('processing')
  })

  it('入库接口失败且可重试时退回待确认，保留待入库数据', () => {
    const pending = { song_id: 'song-1' }
    const next = reduceTask(at('publishing', { pendingPublish: pending }), {
      type: 'failed',
      stage: 'publishing',
      error: '入库失败',
      retryable: true,
    })
    expect(next.state).toBe('ready')
    expect(next.errorStage).toBe('publishing')
    expect(next.error).toBe('入库失败')
    expect(next.pendingPublish).toBe(pending)
  })

  it('服务端入库失败不可重试时进入 failed', () => {
    const next = reduceTask(at('publishing'), {
      type: 'failed',
      stage: 'publishing',
      error: '服务端拒绝',
    })
    expect(next.state).toBe('failed')
  })

  it('已完成任务不会被 failed 覆盖', () => {
    const source = at('published')
    expect(reduceTask(source, { type: 'failed', stage: 'processing', error: 'x' })).toBe(source)
  })
})

describe('上传任务状态机：暂停 / 继续 / 重试', () => {
  it.each(['queued', 'preparing', 'checking', 'uploading'] as UploadState[])(
    '%s 可以暂停',
    (state) => {
      expect(reduceTask(at(state), { type: 'paused' }).state).toBe('paused')
    },
  )

  it('解析与入库期间不可暂停', () => {
    const source = at('processing')
    expect(reduceTask(source, { type: 'paused' })).toBe(source)
    const publishing = at('publishing')
    expect(reduceTask(publishing, { type: 'paused' })).toBe(publishing)
  })

  it('已暂停任务继续后回到 queued 并清空错误', () => {
    const next = reduceTask(at('paused', { error: '已暂停' }), { type: 'resumed' })
    expect(next.state).toBe('queued')
    expect(next.error).toBe('')
    expect(next.errorStage).toBeUndefined()
  })

  it('失败与暂停都可以重试回 queued', () => {
    expect(reduceTask(at('failed'), { type: 'retried' }).state).toBe('queued')
    expect(reduceTask(at('paused'), { type: 'retried' }).state).toBe('queued')
  })

  it('待确认不能被 retried 拉回队列', () => {
    const source = at('ready')
    expect(reduceTask(source, { type: 'retried' })).toBe(source)
  })

  it('reset 清空会话、校验和与进度，回到 queued', () => {
    const next = reduceTask(
      at('failed', {
        sessionId: 's1',
        token: 't1',
        endpoint: '/upload',
        uploadUrl: '/upload/s1',
        sha256: 'sha',
        progress: 80,
        preparationProgress: 50,
        errorStage: 'transfer',
        error: '失败',
      }),
      { type: 'reset' },
    )
    expect(next.state).toBe('queued')
    expect(next.sessionId).toBeUndefined()
    expect(next.token).toBeUndefined()
    expect(next.uploadUrl).toBeUndefined()
    expect(next.sha256).toBeUndefined()
    expect(next.progress).toBe(0)
    expect(next.preparationProgress).toBe(0)
    expect(next.error).toBe('')
  })

  it('queued 不能被 reset', () => {
    const source = at('queued')
    expect(reduceTask(source, { type: 'reset' })).toBe(source)
  })
})

describe('上传任务状态机：重复与跳过', () => {
  it('duplicate 跳过进入 skipped 并清空重复信息', () => {
    const next = reduceTask(at('duplicate', { duplicateOf: 'x', duplicateFile: audioFile() }), {
      type: 'skipped',
    })
    expect(next.state).toBe('skipped')
    expect(next.duplicateOf).toBeUndefined()
    expect(next.duplicateFile).toBeUndefined()
  })

  it('非重复任务不能跳过', () => {
    const source = at('ready')
    expect(reduceTask(source, { type: 'skipped' })).toBe(source)
  })

  it('使用已有文件时可以从 duplicate 进入入库中', () => {
    const next = reduceTask(at('duplicate'), { type: 'transferred', status: 'publishing' })
    expect(next.state).toBe('publishing')
  })

  it('入库失败复核仍重复时退回 duplicate', () => {
    const next = reduceTask(at('publishing'), { type: 'checked', duplicate: true })
    expect(next.state).toBe('duplicate')
  })
})

describe('上传任务状态机：不变量', () => {
  it('12 种状态都能接收任意事件而不抛错', () => {
    for (const state of Object.keys(UPLOAD_STATES) as UploadState[]) {
      for (const event of EVENTS) {
        const source = at(state, { file: audioFile() })
        const next = reduceTask(source, event)
        expect(Object.keys(UPLOAD_STATES)).toContain(next.state)
        expect(source.state).toBe(state)
      }
    }
  })

  it('reducer 不修改入参', () => {
    const source = at('uploading', { progress: 10, error: '' })
    const snapshot = { ...source }
    reduceTask(source, { type: 'progress', progress: 90 })
    expect(source).toEqual(snapshot)
  })
})
