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

  it('入库失败复核仍重复时退回 duplicate', () => {
    const next = reduceTask(at('publishing'), { type: 'checked', duplicate: true })
    expect(next.state).toBe('duplicate')
  })
})
