import type { Page } from '@/types/common'
import type { AudioFile } from '@/types/uploads'
import { request } from './client'

export const filesApi = {
  page(
    params: {
      kind: string
      active?: number
      page: number
      page_size?: number
      batch_id?: string
      pending?: number
      q?: string
    },
    signal?: AbortSignal,
  ) {
    return request<Page<AudioFile>>('files', { searchParams: params, signal })
  },
  image(id: string, signal?: AbortSignal) {
    return request<{ file: AudioFile; references: string[] }>(`files/${id}/image`, { signal })
  },
  remove(id: string, body: Record<string, unknown>) {
    return request<void>(`files/${id}`, { method: 'DELETE', json: body })
  },
  update(id: string, body: Record<string, unknown>) {
    return request<void>(`files/${id}`, { method: 'PATCH', json: body })
  },
  saveDrafts(items: { file_id: string; data: object; organize?: object }[]) {
    return request<void>('files/drafts', { method: 'PUT', json: { items } })
  },
}
