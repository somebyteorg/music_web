import { request } from '@/lib/api/client'
import { filesApi } from '@/lib/api/files'
import type { AlbumMatch } from '@/types/catalog'
import type { PreparedLyric } from '@/types/lyrics'
import type { AudioFile, PublishData } from '@/types/uploads'

interface UploadContextPayload {
  batch_id: string
  relative_path: string
}

interface UploadSession {
  status: string
  error?: string | null
  expires_at?: string
  tus_id?: string | null
}

interface UploadSessionResponse {
  session: UploadSession
  file: AudioFile | null
}

interface UploadSessionCreated {
  session: { id: string }
  token: string
  endpoint: string
}

interface UploadCheckBody {
  sha256: string
  prepared_lyrics?: PreparedLyric[]
  kind: 'audio' | 'cover'
  file_size: number
  context?: UploadContextPayload
}

interface CreateUploadBody {
  kind: 'audio' | 'cover'
  file_name: string
  file_size: number
  song_id?: string
  prepared_lyrics?: PreparedLyric[]
  sha256: string
  context?: UploadContextPayload
}

interface AlbumMatchBody {
  name: string
  artist_name: string
  release_year: number | null
  edition: string
  catalog_number: string
  release_country: string
  label: string
  musicbrainz_id: string | null
  total_discs: number | null
  total_tracks: number | null
}

interface TrackPosition {
  song_id: string
  disc_number: number
  track_number: number
}

interface PublishFileResult {
  file: AudioFile
  song_id: string
}

interface DraftItem {
  file_id: string
  data: object
  organize?: object
}

/**
 * 上传域唯一的 HTTP 出口。
 *
 * 后端契约见 README：POST /api/uploads → { session, token, endpoint }；
 * tus 直传 endpoint；GET /api/uploads/{id} 轮询处理状态；POST .../retry 重试解析。
 */
export const uploadRepository = {
  createSession(body: CreateUploadBody, signal?: AbortSignal) {
    return request<UploadSessionCreated>('uploads', { method: 'POST', json: body, signal })
  },
  getSession(sessionId: string, signal?: AbortSignal) {
    return request<UploadSessionResponse>(`uploads/${sessionId}`, { signal })
  },
  retry(sessionId: string) {
    return request<void>(`uploads/${sessionId}/retry`, { method: 'POST' })
  },
  checkDuplicate(body: UploadCheckBody, signal?: AbortSignal) {
    return request<{ file: AudioFile | null }>('uploads/check', {
      method: 'POST',
      json: body,
      signal,
    })
  },
  saveDrafts(items: DraftItem[]) {
    return filesApi.saveDrafts(items)
  },
  publishFile(fileId: string, data: PublishData) {
    return request<PublishFileResult>(`files/${fileId}/publish`, { method: 'POST', json: data })
  },
  publishFiles(items: (PublishData & { file_id: string })[]) {
    return request<{ items: (PublishFileResult & { album_id: string | null })[] }>(
      'files/publish',
      {
        method: 'POST',
        json: { items },
        // 批量入库可能触发整批转码/写库，保持原有 120s 超时
        timeoutMs: 120_000,
      },
    )
  },
  previewFiles(ids: string[], signal?: AbortSignal) {
    return request<{ files: AudioFile[] }>('files/preview', {
      method: 'POST',
      json: { ids },
      signal,
    })
  },
  albumMatches(body: AlbumMatchBody) {
    return request<{ items: AlbumMatch[] }>('albums/matches', { method: 'POST', json: body })
  },
  albumPositions(albumId: string, signal?: AbortSignal) {
    return request<{ items: TrackPosition[] }>(`albums/${albumId}/positions`, { signal })
  },
}
