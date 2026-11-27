import { computed, ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { type LocationQueryRaw, useRoute, useRouter } from 'vue-router'
import { useDebounceFn } from '@vueuse/core'
import type { Page } from '@/types/common'
import type { CatalogType, Entity } from '@/types/catalog'
import { useQuery } from '@/lib/query'
import { catalogKeys, invalidateScopes } from '@/lib/query/keys'
import { useSignStore } from '@/stores/sign'
import { PAGE_SIZES } from './limits'

export function useCatalog() {
  const route = useRoute()
  const router = useRouter()
  const sign = useSignStore()
  const type = computed(() => route.meta.type as CatalogType)
  const q = ref(String(route.query.q || ''))

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
      PAGE_SIZES.includes(Number(text('page_size')))
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

  /** 请求参数只在一处拼装：URL 即真相，这里把它翻译成后端参数 */
  function params(): Record<string, string | number | undefined> {
    const next: Record<string, string | number | undefined> = {
      page: page.value,
      page_size: pageSize.value,
      q: text('q').slice(0, 100) || undefined,
    }
    if (type.value !== 'playlists') next.sort = sort.value
    if (library.value && ['songs', 'albums'].includes(type.value)) next.library_id = library.value
    if (type.value === 'songs') {
      if (quality.value) next.quality = quality.value
      if (favorites.value) next.favorites = 1
      if (missing.value) next.missing = 1
    }
    if (mine.value) next.mine = 1
    return next
  }

  const query = useQuery<Page<Entity>>({
    key: () => (sign.user ? catalogKeys(sign.user.id).page(route.fullPath) : null),
    fetcher: (signal) => catalogApi.page(type.value, params(), signal),
    staleTime: 60_000,
  })

  /** 列表页数据只在 query.data 就绪后才有意义；未就绪时访问是调用方的时序错误 */
  function catalogPage() {
    const data = query.data.value
    if (!data) throw new Error('catalog 数据未就绪时访问了列表数据')
    return data
  }

  const items = computed<Entity[]>(() => catalogPage().items)
  const total = computed(() => Number(catalogPage().total))
  const loaded = computed(() => query.data.value !== null)

  // 页码越界（例如筛选后总数变少）时收敛到最后一页
  watch(query.data, (data) => {
    if (!data) return
    const last = Math.max(1, Math.ceil(Number(data.total) / (Number(data.page_size) || 1)))
    if (page.value > last) update({ page: last > 1 ? String(last) : undefined }, false, true)
  })

  const search = useDebounceFn(() => {
    if (q.value.trim() !== text('q')) update({ q: q.value.trim().slice(0, 100) }, true, true)
  }, 300)
  watch(q, () => {
    void search()
  })
  watch(
    () => route.fullPath,
    () => {
      q.value = text('q')
      void query.run(false)
    },
    { immediate: true },
  )

  /** 列表写操作之后调用：先按前缀失效，再让 query 自己重取（不接收事件参数，便于直接当 @click 处理器） */
  function load() {
    invalidateScopes(sign.user?.id, ['catalog'])
    return query.run(false)
  }
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
    busy: query.busy,
    loaded,
    error: query.error,
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
