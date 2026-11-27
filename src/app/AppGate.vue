<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import { useAppShellContext } from './appShellContext'

/** 启动门：加载/失败重试与未登录卡片；登录成功后由 App.vue 换成应用骨架。 */
const { sign, booting, bootError, playbackLinks, hydrate } = useAppShellContext()
</script>

<template>
  <div v-if="booting || !sign.ready" class="boot">
    <img alt="跃律" height="56" src="/favicon.svg" width="56" />
    <p>{{ bootError || '正在加载…' }}</p>
    <Button variant="primary" v-if="bootError" @click="hydrate">重试</Button>
  </div>
  <div v-else class="sign-in-screen">
    <main class="sign-in-card">
      <img alt="" class="sign-in-logo" height="56" src="/favicon.svg" width="56" />
      <h1>跃律</h1>
      <p v-if="bootError" class="notice error">{{ bootError }}</p>
      <Button as="a" variant="primary" class="sign-in-link" :href="sign.signUrl">
        <img
          alt=""
          height="24"
          src="https://files.emos.best/files/base/logo/logo_1.jpg"
          width="24"
        />
        使用 EMOS 登录<span aria-hidden="true">↗</span>
      </Button>
      <Button
        as="a"
        variant="secondary"
        class="sign-in-link"
        v-for="link in playbackLinks"
        :key="link.name"
        :aria-label="`新窗口打开 ${link.name} 播放器`"
        :href="link.href"
        rel="noopener noreferrer"
        target="_blank"
      >
        <img :src="link.icon" alt="" height="24" width="24" />
        {{ link.name }}<span aria-hidden="true">↗</span>
      </Button>
    </main>
  </div>
</template>

<style scoped>
@layer components {
  .boot {
    display: flex;
    min-height: 100dvh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    color: var(--text-muted);
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
    background: var(--surface);
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
  @media (max-width: 540px) {
    .sign-in-card {
      padding: 32px 24px;
    }
  }
}
</style>
