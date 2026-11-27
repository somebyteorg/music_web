import type { Router } from 'vue-router'

/**
 * 空闲预取：把路由的懒加载 chunk 提前拉下来，点击进入详情页时不再等待下载。
 *
 * 只预取「路由表里声明为函数」的组件（即真正懒加载的那些），已同步引入的会被跳过；
 * 失败不重试、不抛错——预取失败等价于"没预取"，后续导航仍会自己加载。
 */
export function prefetchRoutes(router: Router) {
  const load = () => {
    for (const route of router.getRoutes()) {
      const components = route.components ?? {}
      for (const component of Object.values(components)) {
        if (typeof component !== 'function') continue
        const loadChunk = component as () => Promise<unknown>
        void loadChunk().catch(() => {})
      }
    }
  }
  if (typeof window.requestIdleCallback === 'function')
    window.requestIdleCallback(load, { timeout: 3000 })
  else window.setTimeout(load, 1500)
}
