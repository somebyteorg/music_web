import { nextTick } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import type { CatalogType } from '@/types/catalog'
import { catalogTypes } from '@/features/catalog/config'

const positions = new Map<string, { left: number; top: number }>()
const catalogs = new Map<string, string>()
export function catalogReturnTo(type: CatalogType) {
  return catalogs.get(type) || `/${type}`
}
const router = createRouter({
  history: createWebHashHistory(),
  async scrollBehavior(to, from, savedPosition) {
    await nextTick()
    if (savedPosition) return savedPosition
    if (to.path === from.path) return to.query.page !== from.query.page ? { top: 0 } : false
    if (to.meta.type && !to.params.id) return positions.get(to.fullPath) || { top: 0 }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      alias: '/home',
      component: () => import('@/views/HomeView.vue'),
      meta: { title: '首页' },
    },
    ...catalogTypes.flatMap((type) => [
      { path: `/${type}`, component: () => import('@/views/CatalogView.vue'), meta: { type } },
      { path: `/${type}/:id`, component: () => import('@/views/DetailView.vue'), meta: { type } },
    ]),
    {
      path: '/uploads',
      component: () => import('@/views/UploadsView.vue'),
      meta: { title: '上传文件' },
    },
    ...(['history', 'members', 'inbox'] as const).map((section) => ({
      path: `/${section}`,
      component: () => import('@/views/CommunityView.vue'),
      meta: {
        section,
        title: { history: '操作记录', members: '成员', inbox: '消息' }[section],
      },
    })),
    {
      path: '/settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: '个人设置' },
    },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFoundView.vue') },
  ],
})
router.beforeEach((_to, from) => {
  positions.set(from.fullPath, { left: window.scrollX, top: window.scrollY })
  if (positions.size > 50) positions.delete(positions.keys().next().value!)
})
router.afterEach((to) => {
  if (to.meta.type && !to.params.id) catalogs.set(to.meta.type as string, to.fullPath)
})
export default router
