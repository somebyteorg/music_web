import { computed, ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { defineStore } from 'pinia'
import type { Entity } from '@/types/catalog'
import { useSignStore } from './sign'

/**
 * 媒体库列表：下拉选项的唯一来源。
 *
 * 缓存语义拆成三个具名动作，不再用布尔参数区分「是否强制」：
 *   load()       读一次；缓存有效就直接返回（组件挂载、选项读取都走这里）
 *   invalidate() 只标脏、不发请求；写操作成功后调用，下一次 load() 自动重取
 *   reload()     忽略缓存立即重取；「重试」按钮用（对应原先的强制刷新那一支）
 */
export const useLibrariesStore = defineStore('libraries', () => {
  const sign = useSignStore()
  const items = ref<Entity[]>([])
  const busy = ref(false)
  const error = ref('')
  let loaded = false
  let pending: Promise<void> | undefined
  const options = computed(() => items.value.map((item) => ({ value: item.id, label: item.name })))
  const defaultId = computed(() => items.value.find((item) => item.is_default)?.id || '')
  watch(
    () => sign.user?.id,
    () => {
      items.value = []
      loaded = false
      busy.value = false
      pending = undefined
      error.value = ''
    },
  )

  /** 读取：缓存有效时直接命中，否则（含 invalidate 之后）拉一次。 */
  function load(): Promise<void> {
    if (pending) return pending
    if (loaded) return Promise.resolve()
    const userId = sign.user?.id
    busy.value = true
    error.value = ''
    pending = (async () => {
      try {
        const result: Entity[] = []
        let page = 1
        let total = 1
        while (result.length < total) {
          const response = await catalogApi.page('libraries', { page, page_size: 60, sort: 'name' })
          result.push(...response.items)
          total = response.total
          page++
          if (!response.items.length) break
        }
        if (sign.user?.id === userId) {
          items.value = result
          loaded = true
        }
      } catch (e) {
        if (sign.user?.id === userId)
          error.value = e instanceof Error ? e.message : '媒体库加载失败，请重试。'
      } finally {
        if (sign.user?.id === userId) {
          busy.value = false
          pending = undefined
        }
      }
    })()
    return pending
  }

  /** 标脏：写操作成功后调用，读路径下一次 load() 会重新拉取。 */
  function invalidate() {
    loaded = false
  }

  /** 强制重取：不动缓存判断，供「重试」按钮使用。 */
  function reload(): Promise<void> {
    loaded = false
    return load()
  }

  return { items, options, defaultId, busy, error, load, reload, invalidate }
})
