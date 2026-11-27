import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublishData } from '@/types/uploads'

const ky = vi.hoisted(() => {
  const http = vi.fn()
  class HTTPError extends Error {
    response: { status: number; clone: () => { json(): Promise<unknown> } }
    constructor(response: { status: number; clone: () => { json(): Promise<unknown> } }) {
      super('HTTPError')
      this.response = response
    }
  }
  return { http, HTTPError }
})

vi.mock('ky', () => ({ default: { create: () => ky.http }, HTTPError: ky.HTTPError }))

import { uploadRepository } from './repository'
import { ApiError } from '@/lib/api/client'

/** 与真实 Response 一致：request() 读 text() 再自行 JSON.parse，空串表示没有内容 */
const ok = (data: unknown = {}, status = 200) => ({
  status,
  text: async () => JSON.stringify(data),
  json: async () => data,
})
const fail = (status: number, data: unknown = null) =>
  new ky.HTTPError({
    status,
    clone: () => ({
      async json() {
        return data
      },
    }),
  })
const calls = () => ky.http.mock.calls
const lastCall = () => calls()[calls().length - 1]!

beforeEach(() => {
  ky.http.mockReset()
  ky.http.mockResolvedValue(ok())
})

describe('repository：会话与查重', () => {
  it('createSession 走 POST /api/uploads，并透传信号', async () => {
    const signal = new AbortController().signal
    ky.http.mockResolvedValueOnce(ok({ session: { id: 's1' }, token: 'tok', endpoint: '/upload' }))
    const body = {
      kind: 'audio' as const,
      file_name: 'a.flac',
      file_size: 3,
      sha256: 'sha',
    }
    await expect(uploadRepository.createSession(body, signal)).resolves.toMatchObject({
      token: 'tok',
      endpoint: '/upload',
    })
    expect(lastCall()[0]).toBe('uploads')
    expect(lastCall()[1]).toMatchObject({ method: 'POST', json: body, signal })
  })

  it('getSession 走 GET /api/uploads/{id}', async () => {
    ky.http.mockResolvedValueOnce(ok({ session: { status: 'processing' }, file: null }))
    await uploadRepository.getSession('s1')
    expect(lastCall()[0]).toBe('uploads/s1')
    expect(lastCall()[1]).toMatchObject({ method: 'GET' })
  })

  it('retry 走 POST /api/uploads/{id}/retry', async () => {
    await uploadRepository.retry('s1')
    expect(lastCall()[0]).toBe('uploads/s1/retry')
    expect(lastCall()[1]).toMatchObject({ method: 'POST' })
  })

  it('checkDuplicate 走 POST /api/uploads/check，带上下文', async () => {
    const signal = new AbortController().signal
    const body = {
      sha256: 'sha',
      kind: 'audio' as const,
      file_size: 3,
      context: { batch_id: 'b1', relative_path: 'a.flac' },
    }
    ky.http.mockResolvedValueOnce(ok({ file: null }))
    await uploadRepository.checkDuplicate(body, signal)
    expect(lastCall()[0]).toBe('uploads/check')
    expect(lastCall()[1]).toMatchObject({ method: 'POST', json: body, signal })
  })
})

describe('repository：发布、预览与专辑', () => {
  it('saveDrafts 走 PUT /api/files/drafts', async () => {
    const items = [{ file_id: 'f1', data: { name: '歌' }, organize: { coverChoice: 'auto' } }]
    await uploadRepository.saveDrafts(items)
    expect(lastCall()[0]).toBe('files/drafts')
    expect(lastCall()[1]).toMatchObject({ method: 'PUT', json: { items } })
  })

  it('publishFile 走 POST /api/files/{id}/publish', async () => {
    const data = { song_id: 'song-1' } as PublishData
    ky.http.mockResolvedValueOnce(ok({ file: { id: 'f1' }, song_id: 'song-1' }))
    await uploadRepository.publishFile('f1', data)
    expect(lastCall()[0]).toBe('files/f1/publish')
    expect(lastCall()[1]).toMatchObject({ method: 'POST', json: data })
  })

  it('publishFiles 批量入库保留 120s 超时', async () => {
    const items = [{ file_id: 'f1', song_id: 'song-1' } as PublishData & { file_id: string }]
    ky.http.mockResolvedValueOnce(ok({ items: [] }))
    await uploadRepository.publishFiles(items)
    expect(lastCall()[0]).toBe('files/publish')
    expect(lastCall()[1]).toMatchObject({ method: 'POST', json: { items }, timeout: 120_000 })
  })

  it('previewFiles 走 POST /api/files/preview', async () => {
    const signal = new AbortController().signal
    ky.http.mockResolvedValueOnce(ok({ files: [] }))
    await uploadRepository.previewFiles(['f1'], signal)
    expect(lastCall()[0]).toBe('files/preview')
    expect(lastCall()[1]).toMatchObject({ method: 'POST', json: { ids: ['f1'] }, signal })
  })

  it('albumMatches 走 POST /api/albums/matches', async () => {
    const body = {
      name: '专辑',
      artist_name: '歌手',
      release_year: null,
      edition: '',
      catalog_number: '',
      release_country: '',
      label: '',
      musicbrainz_id: null,
      total_discs: null,
      total_tracks: null,
    }
    ky.http.mockResolvedValueOnce(ok({ items: [] }))
    await uploadRepository.albumMatches(body)
    expect(lastCall()[0]).toBe('albums/matches')
    expect(lastCall()[1]).toMatchObject({ method: 'POST', json: body })
  })

  it('albumPositions 走 GET /api/albums/{id}/positions', async () => {
    const signal = new AbortController().signal
    ky.http.mockResolvedValueOnce(ok({ items: [] }))
    await uploadRepository.albumPositions('a1', signal)
    expect(lastCall()[0]).toBe('albums/a1/positions')
    expect(lastCall()[1]).toMatchObject({ method: 'GET', signal })
  })
})

describe('repository：错误模型', () => {
  it('422 抛 ApiError 并带 status 与服务端 message', async () => {
    ky.http.mockRejectedValueOnce(fail(422, { message: '校验失败' }))
    const error = await uploadRepository.publishFile('f1', {} as PublishData).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ name: 'ApiError', status: 422, message: '校验失败' })
  })

  it('500 抛 ApiError 并带 status 与默认文案', async () => {
    ky.http.mockRejectedValueOnce(fail(500, null))
    const error = await uploadRepository.getSession('s1').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, message: '服务器出错了，请稍后重试。' })
  })
})
