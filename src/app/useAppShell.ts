import { computed, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import { useSignStore } from '@/stores/sign'
import { useUploadsStore } from '@/stores/uploads'
import { usePlayerStore } from '@/stores/player'
import { clearQueryCache } from '@/lib/query'
import { useQueueStore } from '@/stores/queue'
import { report, useAction } from '@/composables/useFeedback'
import { displayName } from '@/utils/format'
import { communityApi } from '@/lib/api/community'
import { navigation } from './navigation'

export function useAppShell() {
  const sign = useSignStore()
  const uploads = useUploadsStore()
  const player = usePlayerStore()
  const queue = useQueueStore()
  const route = useRoute()
  const router = useRouter()
  const booting = ref(true)
  const bootError = ref('')
  const menu = ref(false)
  const unread = ref(0)
  const menuButton = useTemplateRef<HTMLButtonElement>('menuButton')
  const { busy: signingOut, run: runSignOut } = useAction()
  const accountName = computed(() => displayName(sign.user || undefined))
  const playerVisible = computed(() => player.available || !!queue.current)
  const navidromeIcon = '/web/safari-pinned-tab.svg'
  const playbackLinks = computed(() => [
    { name: 'Navidrome', href: sign.serverUrl, icon: navidromeIcon },
    { name: 'Feishin', href: '/feishin/', icon: '/feishin/assets/128x128.png' },
  ])
  function isActive(path: string) {
    return route.path === path || route.path.startsWith(`${path}/`)
  }
  const heading = computed(
    () =>
      navigation.flatMap((group) => group.items).find((item) => isActive(item.to))?.label ||
      String(route.meta.title || '跃律'),
  )
  async function hydrate() {
    booting.value = true
    bootError.value = ''
    try {
      await router.isReady()
      await sign.hydrate()
      if (sign.user) queue.restore(sign.user.id)
      bootError.value = sign.loginError
      await refreshUnread()
    } catch (e) {
      bootError.value = e instanceof Error ? e.message : '无法连接音乐库，请稍后重试。'
    } finally {
      booting.value = false
    }
  }
  async function refreshUnread() {
    if (sign.user)
      try {
        unread.value = (await communityApi.unread()).count
      } catch {
        /* Session errors are handled globally. */
      }
  }
  function expired() {
    uploads.stop()
    player.close()
    queue.reset()
    clearQueryCache()
    sign.user = null
    report(new Error('登录已过期，请重新登录。'))
  }
  function closeNavigation() {
    menu.value = false
  }
  async function signOut() {
    closeNavigation()
    await runSignOut(() => sign.signOut())
  }
  watch(() => route.path, closeNavigation)
  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (menu.value) {
        menu.value = false
        menuButton.value?.focus()
      }
      document.querySelectorAll<HTMLDetailsElement>('.action-menu[open]').forEach((element) => {
        element.open = false
        element.querySelector<HTMLElement>('summary')?.focus()
      })
    }
  })
  useEventListener(window, 'pointerdown', (event: PointerEvent) => {
    document.querySelectorAll<HTMLDetailsElement>('.action-menu[open]').forEach((element) => {
      if (!element.contains(event.target as Node)) element.open = false
    })
  })
  useEventListener(window, 'session-expired', expired)
  useEventListener(window, 'music-inbox-updated', refreshUnread)
  useEventListener(window, 'music-logout', () => {
    closeNavigation()
    uploads.stop()
    player.close()
    queue.reset()
    clearQueryCache()
  })
  useEventListener(window, 'beforeunload', (event: BeforeUnloadEvent) => {
    if (uploads.activeCount > 0) {
      event.preventDefault()
      event.returnValue = ''
    }
  })
  onMounted(hydrate)
  onUnmounted(() => player.close())

  return {
    sign,
    uploads,
    player,
    route,
    booting,
    bootError,
    menu,
    unread,
    signingOut,
    accountName,
    playerVisible,
    playbackLinks,
    navigation,
    isActive,
    heading,
    hydrate,
    closeNavigation,
    signOut,
  }
}
