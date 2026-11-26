import { computed, ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { defineStore } from 'pinia'
import type { Entity } from '@/types/catalog'
import { useSignStore } from './sign'

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
  function load(refresh = false): Promise<void> {
    if (pending) return pending
    if (loaded && !refresh) return Promise.resolve()
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
  return { items, options, defaultId, busy, error, load }
})
