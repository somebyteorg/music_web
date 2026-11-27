<script lang="ts" setup>
import { computed } from 'vue'
import { useAppShellContext } from './appShellContext'

/** 顶栏账号区：头像/名称、个人设置入口、退出登录。 */
const { sign, accountName, signingOut, closeNavigation, signOut } = useAppShellContext()
// 账号区只在登录后渲染，但 store 的 user 类型仍可空：这里收口成头像地址一个派生值
const avatar = computed(() => sign.user?.avatar)
</script>

<template>
  <div aria-label="当前账户" class="account">
    <div :title="accountName" class="account-profile">
      <img v-if="avatar" :src="avatar" alt="" class="avatar" />
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
</template>

<style scoped>
@layer components {
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
    background: var(--brand-tint-strong);
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
    color: var(--text-meta);
    font-size: 12px;
    white-space: nowrap;
    transition:
      background 0.15s,
      color 0.15s;
  }
  .account-action:hover:not(:disabled) {
    color: var(--brand-strong);
    background: var(--brand-soft);
  }
  .account-action.router-link-active {
    color: var(--brand-strong);
  }
  .account-logout:hover:not(:disabled) {
    color: var(--danger-hover);
    background: var(--danger-soft-hover);
  }
  .account-action .ui-icon {
    width: 18px;
    height: 18px;
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
  }
  @media (max-width: 540px) {
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
  }
}
</style>
