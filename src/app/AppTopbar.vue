<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import { computed, useTemplateRef } from 'vue'
import { useTheme } from '@/composables/useTheme'
import AppAccount from './AppAccount.vue'
import { useAppShellContext } from './appShellContext'
import type { AppTopbarExpose } from './appShellContext'

/** 顶栏：面包屑、消息入口、主题切换、账号区；移动端汉堡按钮也在这里。 */
const { menu, unread, heading, toggleMenu } = useAppShellContext()

// 顶栏主题按钮与设置页「外观」共享同一份单例状态
const {
  preference: themePreference,
  labels: themeNames,
  next: themeNext,
  cycle: cycleTheme,
} = useTheme()
const themeTitle = computed(
  () => `主题：${themeNames[themePreference.value]}，点击切换到${themeNames[themeNext.value]}`,
)

// 汉堡按钮必须是原生 <button>：Esc 收起抽屉后要把焦点还给它，
// 元素 ref 留在本组件，通过 defineExpose 回填给 App.vue 的 keydown 处理。
const menuButton = useTemplateRef<HTMLButtonElement>('menuButton')
const topbarExpose: AppTopbarExpose = {
  focusMenuButton: () => menuButton.value?.focus(),
}
defineExpose(topbarExpose)
</script>

<template>
  <header class="topbar">
    <!-- 模板 ref 必须落在原生元素上（Esc 后直接调 .focus()），故此处不用 IconButton -->
    <button
      ref="menuButton"
      :aria-expanded="menu"
      aria-controls="app-navigation"
      aria-label="打开导航"
      class="icon-button mobile-menu"
      @click="toggleMenu"
    >
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    <div class="breadcrumb">
      <span class="breadcrumb-parent">跃律 <span aria-hidden="true">/</span></span
      ><strong>{{ heading }}</strong>
    </div>
    <div class="topbar-actions">
      <RouterLink
        :aria-label="unread ? `消息，${unread} 条未读消息` : '消息'"
        class="inbox-link"
        title="消息"
        to="/inbox"
      >
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <rect height="14" rx="3" width="18" x="3" y="5" />
          <path d="m3 7 9 6 9-6" />
        </svg>
        <span v-if="unread" class="unread-dot"></span>
      </RouterLink>
      <IconButton :label="themeTitle" :title="themeTitle" class="theme-toggle" @click="cycleTheme">
        <svg
          v-if="themePreference === 'light'"
          aria-hidden="true"
          class="ui-icon"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
          />
        </svg>
        <svg
          v-else-if="themePreference === 'dark'"
          aria-hidden="true"
          class="ui-icon"
          viewBox="0 0 24 24"
        >
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
        <svg v-else aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <rect height="12" rx="2" width="18" x="3" y="4" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      </IconButton>
      <AppAccount />
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 18px;
  height: 72px;
  padding: 0 var(--page-gutter);
  background: var(--surface-glass);
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(16px);
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  color: var(--text-breadcrumb);
  font-size: 12px;
  white-space: nowrap;
}
.breadcrumb-parent {
  flex-shrink: 0;
}
.breadcrumb-parent > span {
  margin-left: 14px;
  color: var(--line-faint);
}
.breadcrumb strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-subtle);
  font-size: 13px;
  font-weight: 500;
}
.topbar-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 12px;
  margin-left: auto;
}
.inbox-link {
  position: relative;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  color: var(--text-link-muted);
  transition:
    background 0.15s,
    color 0.15s;
}
.inbox-link:hover {
  background: var(--brand-soft);
  color: var(--brand);
}
.theme-toggle {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  color: var(--text-faint);
}
.theme-toggle:hover:not(:disabled) {
  background: var(--brand-soft);
  color: var(--brand);
}
.unread-dot {
  position: absolute;
  top: 6px;
  right: 5px;
  width: 6px;
  height: 6px;
  border: 1px solid var(--surface);
  border-radius: 50%;
  background: var(--danger);
}
/* 汉堡按钮只在窄屏出现（侧栏关闭按钮同规则，各自组件持有） */
.mobile-menu {
  display: none;
}
@media (max-width: 1100px) {
  .topbar {
    gap: 14px;
  }
}
@media (max-width: 760px) {
  .mobile-menu {
    display: inline-grid;
  }
  .topbar {
    height: 64px;
    padding-inline: 20px;
  }
}
@media (max-width: 540px) {
  .breadcrumb-parent {
    display: none;
  }
  .topbar-actions {
    gap: 8px;
  }
  .topbar {
    padding-inline: 12px;
    gap: 8px;
  }
}
</style>
