<script lang="ts" setup>
import { ref } from 'vue'
import PlayerBar from '@/components/PlayerBar.vue'
import { notification, notificationTarget } from '@/composables/useFeedback'
import { useAppShell } from '@/app/useAppShell'
import api from '@/utils/ky'

const {
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
  playbackLinks,
  navigation,
  isActive,
  heading,
  hydrate,
  closeNavigation,
  signOut,
} = useAppShell()
const loginToken = ref('')
const tokenLoginError = ref('')
const tokenLoginBusy = ref(false)
async function loginWithToken() {
  const token = loginToken.value.trim()
  if (!token) {
    tokenLoginError.value = '请输入 EMOS 登录令牌。'
    return
  }
  tokenLoginBusy.value = true
  tokenLoginError.value = ''
  try {
    await api.post('login', { json: { token } })
    await hydrate()
    if (!sign.user) tokenLoginError.value = sign.loginError || '未能建立音乐库会话，请重试。'
  } catch (error) {
    tokenLoginError.value = error instanceof Error ? error.message : '登录失败，请检查令牌后重试。'
  } finally {
    loginToken.value = ''
    tokenLoginBusy.value = false
  }
}
</script>
<template>
  <div v-if="booting || !sign.ready" class="boot">
    <img alt="跃律" height="56" src="/favicon.svg" width="56" />
    <p>{{ bootError || '正在加载…' }}</p>
    <button v-if="bootError" class="button primary" @click="hydrate">重试</button>
  </div>
  <div v-else-if="!sign.user" class="sign-in-screen">
    <main class="sign-in-card">
      <img alt="" class="sign-in-logo" height="56" src="/favicon.svg" width="56" />
      <h1>跃律</h1>
      <p v-if="bootError" class="notice error">{{ bootError }}</p>
      <a :href="sign.signUrl" class="button primary sign-in-link">
        <img
          alt=""
          height="24"
          src="https://files.emos.best/files/base/logo/logo_1.jpg"
          width="24"
        />
        使用 EMOS 登录<span aria-hidden="true">↗</span>
      </a>
      <form class="token-login" @submit.prevent="loginWithToken">
        <label for="emos-login-token">或粘贴 EMOS 登录令牌</label>
        <input
          id="emos-login-token"
          v-model="loginToken"
          autocomplete="new-password"
          autocapitalize="off"
          maxlength="4096"
          name="emos-token"
          placeholder="令牌不会显示在屏幕上"
          required
          spellcheck="false"
          type="password"
        />
        <p class="hint">
          令牌只通过当前站点的登录请求交给已配置的 EMOS 服务验证，不会写入 URL 或浏览器存储。
        </p>
        <p v-if="tokenLoginError" class="error-text" role="alert">{{ tokenLoginError }}</p>
        <button
          class="button secondary sign-in-link"
          :disabled="tokenLoginBusy || !loginToken.trim()"
          type="submit"
        >
          {{ tokenLoginBusy ? '正在验证…' : '使用令牌登录' }}
        </button>
      </form>
      <a
        v-for="link in playbackLinks"
        :key="link.name"
        :aria-label="`新窗口打开 ${link.name} 播放器`"
        :href="link.href"
        class="button secondary sign-in-link"
        rel="noopener noreferrer"
        target="_blank"
      >
        <img :src="link.icon" alt="" height="24" width="24" />
        {{ link.name }}<span aria-hidden="true">↗</span>
      </a>
    </main>
  </div>
  <div v-else :class="['app-shell', { 'player-visible': player.available }]">
    <aside id="app-navigation" :class="['sidebar', { expanded: menu }]" aria-label="主导航">
      <div class="sidebar-brand">
        <RouterLink class="brand" to="/" @click="closeNavigation">
          <img alt="" height="40" src="/favicon.svg" width="40" />
          <span>跃律<small>EMOS MUSIC</small></span>
        </RouterLink>
        <button aria-label="关闭导航" class="icon-button mobile-menu" @click="menu = false">
          <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
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
    <button
      v-if="menu"
      aria-label="收起菜单"
      class="sidebar-backdrop"
      @click="menu = false"
    ></button>
    <div class="main-shell">
      <header class="topbar">
        <button
          ref="menuButton"
          :aria-expanded="menu"
          aria-controls="app-navigation"
          aria-label="打开导航"
          class="icon-button mobile-menu"
          @click="menu = !menu"
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
          <div aria-label="当前账户" class="account">
            <div :title="accountName" class="account-profile">
              <img v-if="sign.user.avatar" :src="sign.user.avatar" alt="" class="avatar" />
              <span v-else class="avatar">{{ accountName.slice(0, 1) }}</span>
              <strong class="account-name">{{ accountName }}</strong>
            </div>
            <div class="account-actions">
              <RouterLink
                aria-label="个人设置"
                class="account-action"
                title="个人设置"
                to="/settings"
                @click="closeNavigation"
              >
                <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
                  <path d="M4 7h9m4 0h3M4 17h3m4 0h9M13 4v6M7 14v6" />
                </svg>
                <span class="account-action-label">设置</span>
              </RouterLink>
              <button
                :aria-label="signingOut ? '正在退出' : '退出登录'"
                :disabled="signingOut"
                class="account-action account-logout"
                title="退出登录"
                @click="signOut"
              >
                <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
                  <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5m5-13 5 5-5 5m-6-5h11" />
                </svg>
                <span class="account-action-label">{{ signingOut ? '退出中…' : '退出' }}</span>
              </button>
            </div>
          </div>
        </div>
      </header>
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
.app-shell {
  min-height: 100dvh;
}
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  padding: 30px 16px 18px;
  background: #fff;
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
  color: var(--muted);
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
  color: #9b94a5;
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
  color: #77707f;
  font-size: 14px;
  transition:
    background 0.15s,
    color 0.15s;
}
.sidebar nav a:hover {
  background: var(--soft);
  color: var(--purple-dark);
}
.sidebar nav a.is-active {
  color: var(--purple-dark);
  background: var(--lilac);
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
  background: var(--purple);
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
  color: #aaa3b1;
}
.nav-count {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 6px;
  color: var(--purple-dark);
  background: var(--lilac);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.main-shell {
  margin-left: var(--sidebar-width);
  min-height: 100dvh;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 18px;
  height: 72px;
  padding: 0 var(--page-gutter);
  background: #ffffffd9;
  border-bottom: 1px solid var(--line);
  backdrop-filter: blur(16px);
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  color: #918b9c;
  font-size: 12px;
  white-space: nowrap;
}
.breadcrumb-parent {
  flex-shrink: 0;
}
.breadcrumb-parent > span {
  margin-left: 14px;
  color: #c4c0cc;
}
.breadcrumb strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: #575160;
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
.account {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 5px 6px 5px 12px;
}
.account-profile {
  display: flex;
  align-items: center;
  gap: 10px;
}
.account-profile .avatar {
  width: 32px;
  height: 32px;
  background: #e9e0f6;
  font-size: 13px;
  font-weight: 600;
}
.account-name {
  min-width: 0;
  max-width: 128px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
}
.account-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.account-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 7px 9px;
  border-radius: 9px;
  color: #776b83;
  font-size: 12px;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
}
.account-action:hover:not(:disabled) {
  color: var(--purple-dark);
  background: var(--lilac);
}
.account-action.router-link-active {
  color: var(--purple-dark);
}
.account-logout:hover:not(:disabled) {
  color: #af4d65;
  background: #fff0f3;
}
.account-action .ui-icon {
  width: 18px;
  height: 18px;
}
.inbox-link {
  position: relative;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  color: #8b8196;
  transition:
    background 0.15s,
    color 0.15s;
}
.inbox-link:hover {
  background: var(--lilac);
  color: var(--purple);
}
.unread-dot {
  position: absolute;
  top: 6px;
  right: 5px;
  width: 6px;
  height: 6px;
  border: 1px solid #fff;
  border-radius: 50%;
  background: var(--danger);
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
.mobile-menu,
.sidebar-backdrop {
  display: none;
}
.boot {
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  color: var(--muted);
}
.sign-in-screen {
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 20px;
}
.sign-in-card {
  width: 100%;
  max-width: 400px;
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
  text-align: center;
}
.sign-in-logo {
  margin: 0 auto 16px;
}
.sign-in-card h1 {
  font-size: 26px;
  margin-bottom: 24px;
}
.sign-in-link {
  justify-content: flex-start;
  width: 100%;
  min-height: 44px;
  gap: 10px;
  margin-top: 10px;
}
.sign-in-link img {
  border-radius: 4px;
  object-fit: contain;
}
.sign-in-link > span {
  margin-left: auto;
}
.token-login {
  display: grid;
  gap: 10px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  text-align: left;
}
.token-login > label {
  font-size: 12px;
  font-weight: 600;
}
.token-login > .hint,
.token-login > .error-text {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
}
.token-login > .button {
  margin-top: 0;
  justify-content: center;
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
  background: #fff;
  box-shadow: 0 8px 32px #28233516;
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
@media (max-width: 1100px) {
  .account-action-label {
    display: none;
  }
  .account-action {
    width: 34px;
    padding: 8px;
  }
  .account {
    gap: 12px;
  }
  .topbar {
    gap: 14px;
  }
}
@media (max-width: 760px) {
  .sidebar {
    transform: translateX(-100%);
    width: 240px;
    transition: transform 0.2s;
  }
  .sidebar.expanded {
    transform: translateX(0);
  }
  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 35;
    background: #17132466;
    backdrop-filter: blur(3px);
  }
  .main-shell {
    margin-left: 0;
  }
  .main-content {
    padding: 28px 24px 36px;
  }
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
  .account {
    gap: 8px;
    padding-left: 8px;
  }
  .account-profile {
    gap: 8px;
  }
  .account-name {
    max-width: 64px;
  }
  .account-actions {
    gap: 4px;
  }
  .account-action {
    width: 32px;
    padding-inline: 7px;
  }
  .main-content {
    padding: 24px 18px 32px;
  }
  .topbar {
    padding-inline: 12px;
    gap: 8px;
  }
  .sign-in-card {
    padding: 32px 24px;
  }
  .player-visible .main-content {
    padding-bottom: 140px;
  }
}
</style>
