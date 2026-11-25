import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from '@/App.vue'
import { report } from '@/composables/useFeedback'
import './style.css'

const app = createApp(App)

// 单个组件抛错不该让整站白屏，同时至少留下痕迹
app.config.errorHandler = (error, _instance, info) => {
  console.error('[app]', info, error)
  try {
    report(error instanceof Error ? error : new Error('页面出错了，请刷新重试。'))
  } catch {
    /* 反馈组件自身失败时不要再抛 */
  }
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[promise]', event.reason)
})

// 发版后旧页面引用的旧 chunk 已不存在：自动刷新一次拿新入口，避免白屏
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  window.location.reload()
})

app.use(createPinia()).use(router).mount('#app')
