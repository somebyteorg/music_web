import { describe, expect, it } from 'vitest'
import { createUploadTask, type UploadTask } from './model'
import { fromSnapshot, toSnapshot } from './persistence'
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
