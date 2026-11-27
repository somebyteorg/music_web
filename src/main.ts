import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from '@/App.vue'
import { installTelemetry, reportError } from '@/lib/telemetry'
import './style.css'

// 全局错误钩子必须在挂载前装：启动阶段（路由/首屏请求）的异常也要能被看到
installTelemetry()

const app = createApp(App)
// Vue 渲染与生命周期里的异常不经过 window.onerror，同一个上报入口再挂一次
app.config.errorHandler = (error, _instance, info) => {
  reportError(error, { source: 'vue', info })
}
app.use(createPinia()).use(router).mount('#app')
