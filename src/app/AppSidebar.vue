<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import { useAppShellContext } from './appShellContext'

/** 侧栏：品牌、导航分组、外部播放器入口；移动端抽屉的展开状态由 App.vue 持有。 */
const { uploads, menu, navigation, playbackLinks, isActive, closeNavigation } = useAppShellContext()
</script>

<template>
  <aside id="app-navigation" :class="['sidebar', { expanded: menu }]" aria-label="主导航">
    <div class="sidebar-brand">
      <RouterLink class="brand" to="/" @click="closeNavigation">
        <img alt="" height="40" src="/favicon.svg" width="40" />
        <span>跃律<small>EMOS MUSIC</small></span>
      </RouterLink>
      <IconButton label="关闭导航" class="mobile-menu" @click="closeNavigation">
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </IconButton>
    </div>
    <div v-for="group in navigation" :key="group.label" class="nav-group">
      <p class="nav-label">{{ group.label }}</p>
      <nav :aria-label="group.label">
        <RouterLink
          v-for="item in group.items"
          :key="item.to"
          :aria-current="isActive(item.to) ? 'page' : undefined"
          :class="{ 'is-active': isActive(item.to) }"
          :to="item.to"
          @click="closeNavigation"
        >
          <svg aria-hidden="true" class="ui-icon nav-icon" viewBox="0 0 24 24">
            <path :d="item.icon" />
          </svg>
          <span>{{ item.label }}</span>
          <span
            v-if="item.to === '/uploads' && uploads.activeCount"
            :title="`${uploads.activeCount} 个上传任务进行中`"
            class="nav-count"
            >{{ uploads.activeCount > 99 ? '99+' : uploads.activeCount }}</span
          >
        </RouterLink>
      </nav>
    </div>
    <div class="nav-group">
      <p class="nav-label">播放</p>
      <nav aria-label="播放">
        <a
          v-for="link in playbackLinks"
          :key="link.name"
          :aria-label="`新窗口打开 ${link.name} 播放器`"
          :href="link.href"
          class="server-link"
          rel="noopener noreferrer"
          target="_blank"
        >
          <img :src="link.icon" alt="" class="nav-icon" height="19" width="19" />
          <span>{{ link.name }}</span>
          <svg aria-hidden="true" class="ui-icon nav-external" viewBox="0 0 24 24">
            <path d="M7 17 17 7M7 7h10v10" />
          </svg>
        </a>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  padding: 30px 16px 18px;
  background: var(--surface);
  border-right: 1px solid var(--line);
  overflow-y: auto;
}
.sidebar-brand {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 40px;
  padding-inline: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand > img {
  width: 40px;
  height: 40px;
}
.brand > span {
  font-size: 26px;
  font-weight: 750;
  letter-spacing: 2px;
  line-height: 1.2;
}
.brand small {
  display: block;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 1.8px;
  margin-top: 5px;
}
.nav-group + .nav-group {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
}
.nav-label {
  margin: 0 14px 12px;
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 2px;
}
.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.sidebar nav a {
  position: relative;
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 46px;
  padding: 11px 14px;
  border-radius: 9px;
  color: var(--nav-item);
  font-size: 14px;
  transition:
    background 0.15s,
    color 0.15s;
}
.sidebar nav a:hover {
  background: var(--surface-muted);
  color: var(--brand-strong);
}
.sidebar nav a.is-active {
  color: var(--brand-strong);
  background: var(--brand-soft);
  font-weight: 600;
}
.sidebar nav a.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15px;
  bottom: 15px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--brand);
}
.nav-icon {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
}
.nav-external {
  width: 15px;
  height: 15px;
  margin-left: auto;
  color: var(--text-ghost);
}
.nav-count {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 6px;
  color: var(--brand-strong);
  background: var(--brand-soft);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
/* 抽屉的关闭按钮只在窄屏出现（顶栏汉堡按钮同规则，各自组件持有） */
.mobile-menu {
  display: none;
}
@media (max-width: 760px) {
  .sidebar {
    transform: translateX(-100%);
    width: 240px;
    transition: transform var(--transition-base);
  }
  .sidebar.expanded {
    transform: translateX(0);
  }
  .mobile-menu {
    display: inline-grid;
  }
}
</style>
