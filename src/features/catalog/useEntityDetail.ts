import { computed, onMounted, ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { useRoute } from 'vue-router'
import type { CatalogType, Entity } from '@/types/catalog'
import { useQuery } from '@/lib/query'
import { detailKeys, invalidateScopes } from '@/lib/query/keys'
import { useSignStore } from '@/stores/sign'
import { catalogReturnTo } from '@/router'
import { DETAIL_SONG_PAGE_SIZE } from './limits'
import { assertPage, getSongPage } from './songs'
import { readTracksPage, resolveTracksStatus, type TracksStatus } from './tracksStatus'

export function useEntityDetail() {
  const route = useRoute()
  const sign = useSignStore()
  // App keys detail views by path, so each instance owns one entity.
  const type = route.meta.type as CatalogType
  const id = String(route.params.id)
  const backTo = catalogReturnTo(type)
  const page = ref(1)
  const songPageSize = ref(DETAIL_SONG_PAGE_SIZE)
  const editable = ref(true)

  const detail = useQuery<{ item: Entity; can_edit?: boolean }>({
    key: () => (sign.user ? detailKeys(sign.user.id).item(type, id) : null),
    fetcher: (signal) => catalogApi.item(type, id, signal),
    staleTime: 30_000,
  })
  const tracks = useQuery<{ items: Entity[]; total: number; page_size: number }>({
    key: () =>
      sign.user ? detailKeys(sign.user.id).songs(type, id, page.value, songPageSize.value) : null,
    fetcher: async (signal) => {
      const result = assertPage(await getSongPage(type, id, page.value, songPageSize.value, signal))
      return {
        items: result.items,
        total: Number(result.total),
        page_size: Number(result.page_size) || songPageSize.value,
      }
    },
    staleTime: 30_000,
  })

  watch(detail.data, (data) => {
    if (data) editable.value = data.can_edit ?? true
  })
  watch(tracks.data, (data) => {
    if (data) songPageSize.value = data.page_size
  })

  const tracksStatus = computed<TracksStatus>(() =>
    resolveTracksStatus({
      type,
      hasData: tracks.data.value !== null,
      busy: tracks.busy.value,
      error: tracks.error.value,
    }),
  )
  const tracksError = computed(() => tracks.error.value)

  /** 只有曲目 ready 才允许读 songs / total；其它状态由调用方按 tracksStatus 分支 */
  function tracksPage() {
    return readTracksPage(tracksStatus.value, tracks.data.value)
  }

  // 详情与曲目解耦：详情成功就先渲染 hero，曲目失败只在曲目区显示错误
  const item = computed<Entity | undefined>(() => detail.data.value?.item)
  const songs = computed<Entity[]>(() => tracksPage().items)
  const total = computed(() => tracksPage().total)
  // 整页 busy / error 只反映详情，曲目状态走 tracksStatus / tracksError
  const busy = computed(() => detail.busy.value)
  const error = computed(() => detail.error.value)

  /** 曲目分页刷新（切页、重试）：新页码本来就是 miss，回到 30s 内看过的页则直接吃缓存 */
  async function loadSongs() {
    if (type === 'songs') return
    await tracks.run(false)
  }

  /**
   * 详情写操作之后的刷新：详情与曲目按前缀失效，再由 query 自己重取（无参数，可直接当事件处理器）。
   * 写点通常已经失效过 detail，这里再失效一次是幂等兜底：漏失效的代价是旧数据，重复失效只是删几个 Map 项。
   */
  async function load() {
    invalidateScopes(sign.user?.id, ['detail'])
    await detail.run(false)
    if (detail.data.value?.item && type !== 'songs') await loadSongs()
  }

  // 首屏先吃缓存，缺的再回源
  onMounted(async () => {
    await detail.run(false)
    if (detail.data.value?.item && type !== 'songs') await tracks.run(false)
  })

  return {
    type,
    id,
    backTo,
    item,
    songs,
    tracksStatus,
    tracksError,
    page,
    total,
    songPageSize,
    busy,
    error,
    editable,
    load,
    loadSongs,
  }
}
