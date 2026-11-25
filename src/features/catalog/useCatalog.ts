import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { type LocationQueryRaw, useRoute, useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import { getCatalogPage } from './api'
import { useSignStore } from '@/stores/sign'
import type { CatalogType, Entity } from '@/types/catalog'
import type { Page } from '@/types/common'

const cache = new Map<string, Page<Entity>>()
export function useCatalog() {
  const route = useRoute()
  const router = useRouter()
  const sign = useSignStore()
  const type = computed(() => route.meta.type as CatalogType)
  const items = ref<Entity[]>([])
  const total = ref(0)
  const busy = ref(false)
  const loaded = ref(false)
  const error = ref('')
  const q = ref(String(route.query.q || ''))
  let controller: AbortController | undefined
  let disposed = false
  function text(key: string) {
    return typeof route.query[key] === 'string' ? (route.query[key] as string) : ''
  }
  function update(values: LocationQueryRaw, resetPage = true, replace = false) {
    const query: LocationQueryRaw = {
      ...route.query,
      q: q.value.trim().slice(0, 100) || undefined,
      ...(resetPage ? { page: undefined } : {}),
      ...values,
    }
    for (const key of Object.keys(query)) if (!query[key]) delete query[key]
    void router[replace ? 'replace' : 'push']({ path: route.path, query })
  }
  const page = computed({
    get: () => Math.max(1, Math.trunc(Number(text('page'))) || 1),
    set: (value: number) => update({ page: value > 1 ? String(value) : undefined }, false),
  })
  const pageSize = computed({
    get: () =>
      [24, 48, 60].includes(Number(text('page_size')))
        ? Number(text('page_size'))
        : type.value === 'songs'
          ? 48
          : 24,
    set: (value: number) => update({ page_size: String(value) }),
  })
  const sort = computed({
    get: () => (['name', 'oldest'].includes(text('sort')) ? text('sort') : 'latest'),
    set: (value: string) => update({ sort: value === 'latest' ? undefined : value }),
  })
  const quality = computed({
    get: () =>
      ['standard', 'high', 'lossless', 'hires'].includes(text('quality')) ? text('quality') : '',
    set: (value: string) => update({ quality: value }),
  })
  const library = computed({
    get: () => text('library_id'),
    set: (value: string) => update({ library_id: value || undefined }),
  })
  function toggle(key: string) {
    return computed({
      get: () => text(key) === '1',
      set: (value: boolean) => update({ [key]: value ? '1' : undefined }),
    })
  }
  const favorites = toggle('favorites')
  const missing = toggle('missing')
  const mine = toggle('mine')
  const filtered = computed(
    () =>
      !!(
        q.value ||
        quality.value ||
        library.value ||
        favorites.value ||
        missing.value ||
        mine.value ||
        sort.value !== 'latest'
      ),
  )
  async function load() {
    controller?.abort()
    const request = new AbortController()
    controller = request
    const key = `${sign.user?.id}:${route.fullPath}`
    const saved = cache.get(key)
    if (saved && !loaded.value) {
      items.value = saved.items
      total.value = saved.total
      loaded.value = true
    }
    busy.value = true
    error.value = ''
    const params: Record<string, string | number> = {
      page: page.value,
      page_size: pageSize.value,
      q: text('q').slice(0, 100),
    }
    if (type.value !== 'playlists') params.sort = sort.value
    if (library.value && ['songs', 'albums'].includes(type.value)) params.library_id = library.value
    if (type.value === 'songs') {
      if (quality.value) params.quality = quality.value
      if (favorites.value) params.favorites = 1
      if (missing.value) params.missing = 1
    }
    if (mine.value) params.mine = 1
    try {
      const result = await getCatalogPage(type.value, params, request.signal)
      if (request.signal.aborted) return
      // 接口形状不对（例如返回空对象）时明确报错，而不是让 undefined 冒到模板里
      if (!result || !Array.isArray(result.items) || !Number.isFinite(Number(result.total)))
        throw new Error('音乐库接口返回的数据格式异常，请稍后重试。')
      total.value = Number(result.total)
      const pageSizeValue = Number(result.page_size) || pageSize.value
      const last = Math.max(1, Math.ceil(total.value / pageSizeValue))
      if (page.value > last) {
        update({ page: last > 1 ? String(last) : undefined }, false, true)
        return
      }
      items.value = result.items
      loaded.value = true
      cache.delete(key)
      cache.set(key, result)
      if (cache.size > 20) cache.delete(cache.keys().next().value!)
    } catch (e) {
      if (!request.signal.aborted)
        error.value = e instanceof Error ? e.message : '加载失败，请重试。'
    } finally {
      if (!request.signal.aborted) busy.value = false
    }
  }
  const search = useDebounceFn(() => {
    if (!disposed && q.value.trim() !== text('q'))
      update({ q: q.value.trim().slice(0, 100) }, true, true)
  }, 300)
  watch(q, () => {
    void search()
  })
  watch(
    () => route.fullPath,
    () => {
      q.value = text('q')
      void load()
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    disposed = true
    controller?.abort()
  })
  function reset() {
    q.value = ''
    update({
      q: undefined,
      quality: undefined,
      library_id: undefined,
      favorites: undefined,
      missing: undefined,
      mine: undefined,
      sort: undefined,
    })
  }
  return {
    type,
    items,
    total,
    busy,
    loaded,
    error,
    q,
    page,
    pageSize,
    sort,
    quality,
    library,
    favorites,
    missing,
    mine,
    filtered,
    load,
    reset,
  }
}
