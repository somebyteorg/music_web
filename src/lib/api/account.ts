import { request } from './client'
import type { ContributionConfig, User } from '@/types/session'

export interface SessionPayload {
  user: User | null
  contribution: ContributionConfig
  sign_url: string
  login_error: string | null
  server_url: string
  todb_enabled: boolean
}

export const accountApi = {
  session() {
    return request<SessionPayload>('session')
  },
  csrfToken() {
    return request<{ csrf_token: string }>('csrf-token')
  },
  logout() {
    return request<void>('logout', { method: 'POST' })
  },
  acceptNotice(body: { accepted: boolean; version?: string }) {
    return request<{ user: User }>('notice/accept', { method: 'POST', json: body })
  },
  updateProfile<T>(body: Record<string, unknown>) {
    return request<T>('profile', { method: 'PATCH', json: body })
  },
  profileLibraries<T>() {
    return request<T>('profile/libraries')
  },
  updateProfileLibraries<T>(libraryIds: number[]) {
    return request<T>('profile/libraries', { method: 'PUT', json: { library_ids: libraryIds } })
  },
}
