import { computed, onMounted, ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { useRoute } from 'vue-router'
import type { CatalogType, Entity } from '@/types/catalog'
import { useQuery } from '@/lib/query'
import { useSignStore } from '@/stores/sign'
import { catalogReturnTo } from '@/router'
import { DETAIL_SONG_PAGE_SIZE } from './limits'
import { assertPage, getSongPage } from './songs'

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
    key: () => (sign.user ? `${sign.user.id}:detail:${type}:${id}` : null),
    fetcher: (signal) => catalogApi.item(type, id, signal),
    staleTime: 30_000,
  })
  const tracks = useQuery<{ items: Entity[]; total: number; page_size: number }>({
    key: () =>
      sign.user
        ? `${sign.user.id}:detail-songs:${type}:${id}:${page.value}:${songPageSize.value}`
        : null,
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

  /** 曲目查询就绪后才允许读 songs / total，避免用默认空列表掩盖时序错误 */
  function tracksPage() {
    const data = tracks.data.value
    if (!data) throw new Error('曲目数据未就绪时访问了歌曲列表')
    return data
  }

  const tracksLoaded = computed(() => tracks.data.value !== null)
  // 非歌曲详情（专辑/歌单/艺人/媒体库）必须等详情与曲目都就绪再渲染，避免半页数据
  const item = computed<Entity | undefined>(() => {
    const data = detail.data.value
    if (!data) return undefined
    if (type !== 'songs' && !tracks.data.value) return undefined
    return data.item
  })
  const songs = computed<Entity[]>(() => tracksPage().items)
  const total = computed(() => tracksPage().total)
  const busy = computed(() => detail.busy.value || tracks.busy.value)
  const error = computed(() => detail.error.value || tracks.error.value)

  /** 曲目分页刷新（切页、写操作后调用） */
  async function loadSongs() {
    if (type === 'songs') return
    await tracks.run(true)
  }

  /** 详情刷新：无参数，视图里可直接当事件处理器用 */
  async function load() {
    await detail.run(true)
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
    tracksLoaded,
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
