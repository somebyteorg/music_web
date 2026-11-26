import { request } from './client'

export const communityApi = {
  unread() {
    return request<{ count: number }>('inbox/unread')
  },
  markRead(id?: number) {
    return request<void>('inbox/read', { method: 'POST', json: id ? { ids: [id] } : {} })
  },
  restoreHistory(id: number) {
    return request<void>(`history/${id}/restore`, { method: 'POST' })
  },
  changeRole(memberId: number, role: string) {
    return request<void>(`members/${memberId}/role`, { method: 'PATCH', json: { role } })
  },
}
