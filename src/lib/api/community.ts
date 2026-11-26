import type { Page } from '@/types/common'
import { request } from './client'

type Params = Record<string, string | number | undefined>

export const communityApi = {
  history<T>(params: Params, signal?: AbortSignal) {
    return request<Page<T>>('history', { searchParams: params, signal })
  },
  members<T>(params: Params, signal?: AbortSignal) {
    return request<Page<T>>('members', { searchParams: params, signal })
  },
  inbox<T>(params: Params, signal?: AbortSignal) {
    return request<Page<T>>('inbox', { searchParams: params, signal })
  },
  unread() {
    return request<{ count: number }>('inbox/unread')
  },
  markRead(id?: number) {
    return request<void>('inbox/read', { method: 'POST', json: id ? { ids: [id] } : {} })
  },
  restoreHistory(id: string | number) {
    return request<void>(`history/${id}/restore`, { method: 'POST' })
  },
  changeRole(memberId: number, role: string) {
    return request<void>(`members/${memberId}/role`, { method: 'PATCH', json: { role } })
  },
}
