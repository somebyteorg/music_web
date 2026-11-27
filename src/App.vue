<script lang="ts" setup>
import { computed, provide, useTemplateRef } from 'vue'
import AppGate from '@/app/AppGate.vue'
import AppSidebar from '@/app/AppSidebar.vue'
import AppTopbar from '@/app/AppTopbar.vue'
import { appShellKey } from '@/app/appShellContext'
import type { AppTopbarExpose } from '@/app/appShellContext'
import { useAppShell } from '@/app/useAppShell'
import PlayerBar from '@/components/PlayerBar.vue'
import { notification, notificationTarget } from '@/composables/useFeedback'

/**
 * 应用骨架：只做全局接线（useAppShell → provide）、路由出口、播放器与全局提示。
 * 启动/登录门、侧栏、顶栏分别从 appShellContext 取状态与动作，骨架不再持有它们的模板。
 */
const topbar = useTemplateRef<AppTopbarExpose>('topbar')
const shell = useAppShell({ focusMenuButton: () => topbar.value?.focusMenuButton() })
provide(appShellKey, shell)

const { sign, booting, menu, playerVisible, route, closeNavigation } = shell
const signedIn = computed(() => !booting.value && sign.ready && !!sign.user)
</script>

<template>
  <AppGate v-if="!signedIn" />
  <div v-else :class="['app-shell', { 'player-visible': playerVisible }]">
    <AppSidebar />
    <button
      v-if="menu"
      aria-label="收起菜单"
      class="sidebar-backdrop"
      @click="closeNavigation"
    ></button>
    <div class="main-shell">
      <AppTopbar ref="topbar" />
      <main id="main" class="main-content">
        <RouterView v-slot="{ Component }"
          ><component :is="Component" :key="route.path"
        /></RouterView>
      </main>
    </div>
    <PlayerBar />
  </div>
  <Teleport :to="notificationTarget"
    ><Transition name="toast"
      ><div
        v-if="notification"
        :class="['toast', { error: notification.error }]"
        role="status"
        @click="notification = null"
      >
        <span>{{ notification.error ? '!' : '✓' }}</span>{{ notification.text
        }}<button aria-label="关闭提示">×</button>
      </div></Transition
    ></Teleport
  >
</template>

<style scoped>
@layer components {
  .app-shell {
    min-height: 100dvh;
  }
  .main-shell {
    margin-left: var(--sidebar-width);
    min-height: 100dvh;
  }
  .main-content {
    width: 100%;
    max-width: 1680px;
    margin-inline: auto;
    padding: 36px var(--page-gutter) 48px;
  }
  .player-visible .main-content {
    padding-bottom: 120px;
  }
  .sidebar-backdrop {
    display: none;
  }
  .toast {
    position: fixed;
    z-index: 200;
    bottom: 104px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    width: max-content;
    max-width: min(680px, calc(100% - 24px));
    padding: 14px 20px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow-md);
    font-size: 13px;
    line-height: 1.6;
  }
  .toast > span {
    color: var(--success);
    font-weight: 700;
  }
  .toast.error > span {
    color: var(--danger);
  }
  .toast > button {
    margin-left: 8px;
    font-size: 18px;
  }
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.15s;
  }
  .toast-enter-from,
  .toast-leave-to {
    opacity: 0;
  }
  @media (max-width: 760px) {
    .sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 35;
      background: var(--scrim-sidebar);
      backdrop-filter: blur(3px);
    }
    .main-shell {
      margin-left: 0;
    }
    .main-content {
      padding: 28px 24px 36px;
    }
  }
  @media (max-width: 540px) {
    .main-content {
      padding: 24px 18px 32px;
    }
    .player-visible .main-content {
      padding-bottom: 140px;
    }
  }
}
</style>
