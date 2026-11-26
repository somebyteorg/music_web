import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { setCsrfToken } from '@/lib/api/client'
import { accountApi } from '@/lib/api/account'
import type { ContributionConfig, User } from '@/types/session'

export const useSignStore = defineStore('sign', () => {
  const user = ref<User | null>(null)
  const config = ref<ContributionConfig | null>(null)
  const ready = ref(false)
  const signUrl = ref('')
  const loginError = ref('')
  const serverUrl = ref('/web/')
  const todbEnabled = ref(false)
  const isSignedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const canModerate = computed(() => ['admin', 'edit'].includes(user.value?.role || ''))

  async function hydrate() {
    const session = await accountApi.session()
    const { csrf_token } = await accountApi.csrfToken()
    user.value = session.user
    config.value = session.contribution
    signUrl.value = session.sign_url
    loginError.value = session.login_error || ''
    serverUrl.value = session.server_url
    todbEnabled.value = session.todb_enabled
    setCsrfToken(csrf_token)
    ready.value = true
  }

  async function signOut() {
    await accountApi.logout()
    user.value = null
    window.dispatchEvent(new Event('music-logout'))
    await hydrate()
  }

  async function acceptNotice() {
    const result = await accountApi.acceptNotice({
      accepted: true,
      version: config.value?.notice.version,
    })
    user.value = result.user
  }

  return {
    user,
    config,
    ready,
    signUrl,
    loginError,
    serverUrl,
    todbEnabled,
    isSignedIn,
    isAdmin,
    canModerate,
    hydrate,
    signOut,
    acceptNotice,
  }
})
export default useSignStore
