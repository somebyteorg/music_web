import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// mocks/视觉回归可以由 STUB_API_PORT 指定另一套 mock 后端端口
const apiTarget = `http://127.0.0.1:${process.env.STUB_API_PORT || '8000'}`
// tus 直传默认指向本机 4060；端到端冒烟把它也指到 mock 后端（STUB_TUS_PORT）
const tusTarget = `http://127.0.0.1:${process.env.STUB_TUS_PORT || '4060'}`
const proxy = {
  '/api': { target: apiTarget, changeOrigin: true },
  '^/upload(?:[/?]|$)': {
    target: tusTarget,
    changeOrigin: false,
    xfwd: true,
    timeout: 0,
    proxyTimeout: 0,
  },
}

export default defineConfig(() => {
  return {
    plugins: [vue(), tailwindcss()],
    worker: { format: 'es' as const },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy,
    },
    // 视觉回归直接测构建产物：preview 也要把 /api 转给 mock 后端
    preview: {
      host: '127.0.0.1',
      port: 4173,
      proxy,
    },
  }
})
