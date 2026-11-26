import { describe, expect, it } from 'vitest'
import { reduceTask, type UploadEvent } from './machine'
import {
  createUploadTask,
  UPLOAD_STATES,
  type TaskDraft,
  type TaskMetadata,
  type TaskTransfer,
  type UploadState,
  type UploadTask,
} from './model'
import type { AudioFile } from '@/types/uploads'

const audioFile = () => ({ id: 'file-1', song_id: null, file_name: 'a.flac' }) as AudioFile

interface Overrides {
  transfer?: Partial<TaskTransfer>
  metadata?: Partial<TaskMetadata>
  draft?: Partial<TaskDraft>
}

function at(state: UploadState, overrides: Overrides = {}): UploadTask {
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
    state,
    transfer: { ...base.transfer, file: audioFile(), ...overrides.transfer },
    metadata: { ...base.metadata, ...overrides.metadata },
    draft: { ...base.draft, ...overrides.draft },
  }
}

/** 每个事件的合法来源；未列出的状态 × 事件组合必须原样返回同一引用 */
const LEGAL: { event: UploadEvent; sources: UploadState[] }[] = [
  { event: { type: 'started' }, sources: ['queued'] },
  { event: { type: 'prepared' }, sources: ['preparing'] },
  { event: { type: 'checked', duplicate: true }, sources: ['checking', 'publishing'] },
  { event: { type: 'checked', duplicate: false }, sources: ['checking'] },
  {
    event: { type: 'sessionCreated', sessionId: 's1', token: 't', endpoint: '/upload' },
    sources: ['preparing', 'checking', 'uploading'],
  },
  {
    event: { type: 'sessionRestored' },
    sources: ['preparing', 'checking', 'processing', 'publishing', 'paused', 'failed', 'ready'],
  },
  { event: { type: 'publishingStarted' }, sources: ['ready', 'duplicate'] },
  {
    event: { type: 'publishingQueued', payload: { song_id: 'song-1' } },
    sources: ['ready', 'duplicate'],
  },
  { event: { type: 'publishingDiscarded' }, sources: ['ready'] },
  {
    event: { type: 'progress', progress: 10, preparationProgress: 10 },
    sources: ['preparing', 'uploading'],
  },
  { event: { type: 'transferred' }, sources: ['uploading'] },
  { event: { type: 'processed' }, sources: ['processing', 'publishing'] },
  { event: { type: 'reused' }, sources: ['duplicate', 'ready', 'published'] },
  {
    event: { type: 'published', songId: 'song-1' },
    sources: ['ready', 'publishing', 'processing', 'duplicate', 'published'],
  },
  {
    event: { type: 'failed', stage: 'processing', error: 'x' },
    sources: [
      'queued',
      'preparing',
      'checking',
      'uploading',
      'processing',
      'ready',
      'failed',
      'publishing',
      'paused',
    ],
  },
  {
    event: { type: 'paused' },
    sources: ['queued', 'preparing', 'checking', 'uploading', 'failed', 'ready', 'duplicate'],
  },
  { event: { type: 'resumed' }, sources: ['paused'] },
  { event: { type: 'retried' }, sources: ['failed', 'paused', 'duplicate'] },
  { event: { type: 'skipped' }, sources: ['duplicate'] },
  { event: { type: 'reset' }, sources: ['failed', 'paused', 'ready'] },
]

const STATES = Object.keys(UPLOAD_STATES) as UploadState[]

describe('状态机迁移矩阵', () => {
  it('只允许声明过的来源，其余组合返回同一引用', () => {
    for (const { event, sources } of LEGAL) {
      for (const state of STATES) {
        const source = at(state)
        const next = reduceTask(source, event)
        if (sources.includes(state)) {
          expect(next, `${state} + ${event.type} 应合法`).not.toBe(source)
          expect(STATES).toContain(next.state)
        } else {
          expect(next, `${state} + ${event.type} 应非法`).toBe(source)
        }
      }
    }
  })

  it('12 种状态都能被矩阵覆盖', () => {
    expect(STATES).toHaveLength(12)
    expect(STATES).toEqual(
      expect.arrayContaining([
        'queued',
        'preparing',
        'checking',
        'uploading',
        'paused',
        'processing',
        'publishing',
        'ready',
        'duplicate',
        'skipped',
        'published',
        'failed',
      ]),
    )
  })

  it('已完成、已跳过不会重新回到上传流程', () => {
    for (const state of ['published', 'skipped'] as UploadState[]) {
      for (const event of [
        { type: 'started' },
        { type: 'prepared' },
        { type: 'transferred' },
        { type: 'processed' },
        { type: 'sessionRestored' },
        { type: 'publishingStarted' },
        { type: 'publishingQueued', payload: {} },
        { type: 'publishingDiscarded' },
        { type: 'resumed' },
        { type: 'retried' },
        { type: 'reset' },
      ] as UploadEvent[]) {
        const source = at(state)
        expect(reduceTask(source, event), `${state} + ${event.type}`).toBe(source)
      }
    }
  })

  it('reducer 不修改入参', () => {
    const source = at('uploading')
    const snapshot = structuredClone(source)
    reduceTask(source, { type: 'progress', progress: 90 })
    expect(source).toEqual(snapshot)
  })
})
