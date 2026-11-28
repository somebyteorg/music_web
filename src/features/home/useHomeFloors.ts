import { computed, ref, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { catalogApi, type QueryParams } from '@/lib/api/catalog'
import { useQuery } from '@/lib/query'
import { homeKeys } from '@/lib/query/keys'
import { usePlayerStore } from '@/stores/player'
import { useSignStore } from '@/stores/sign'
import type { Page } from '@/types/common'
import type { Entity } from '@/types/catalog'
import { FAVORITES_UPDATED_EVENT, readFavorites, type FavoriteRecord } from './favorites'
import {
  HISTORY_UPDATED_EVENT,
  continueListening,
  readHistory,
  topAlbums,
  topArtists,
  type PlayRecord,
} from './playHistory'
import {
  ALBUM_ROW_SIZE,
  ARTIST_ROW_MIN,
  ARTIST_ROW_SIZE,
  CONTINUE_SIZE,
  SONG_ROW_SIZE,
  idScope,
  progressLabel,
  randomPage,
  unheardSongs,
} from './recommendations'

/** 一层楼：组件只负责把它画出来（songs 与 albums 二选一） */
export interface HomeRow {
  key: string
  title: string
  subtitle?: string
  songs: Entity[]
  albums: Entity[]
  /** songId → 副文案（继续听显示播放进度） */
  hints: Record<string, string>
  playLabel?: string
  reshuffle?: boolean
}

const STALE_TIME = 5 * 60_000
const ARTIST_SLOTS = 3

/** 按 id 批量取详情：并行 + 逐条容错（某一条失败只丢那一条，不影响整层） */
async function fetchByIds(
  type: 'songs' | 'albums',
  ids: string[],
  signal: AbortSignal,
): Promise<Entity[]> {
  const results = await Promise.allSettled(ids.map((id) => catalogApi.item(type, id, signal)))
  const items: Entity[] = []
  for (const result of results) if (result.status === 'fulfilled') items.push(result.value.item)
  return items
}

/**
 * 首页楼层的数据源：本地播放历史 / 本地收藏 + catalog 列表参数。
 * 后端没有推荐接口，所有「推荐规则」都在 features/home 里，组件只渲染 HomeRow。
 */
export function useHomeFloors() {
  const sign = useSignStore()
  const player = usePlayerStore()
  const userId = computed<number | null>(() => sign.user?.id ?? null)
  const history = ref<PlayRecord[]>([])
  const favorites = ref<FavoriteRecord[]>([])
  const page = ref(randomPage())

  function refreshLocal() {
    const id = userId.value
    history.value = id === null ? [] : readHistory(id)
    favorites.value = id === null ? [] : readFavorites(id)
  }
  watch(userId, refreshLocal, { immediate: true })
  useEventListener(window, HISTORY_UPDATED_EVENT, refreshLocal)
  useEventListener(window, FAVORITES_UPDATED_EVENT, refreshLocal)

  const tasteArtists = computed(() => topArtists(history.value, ARTIST_SLOTS))
  const tasteAlbums = computed(() => topAlbums(history.value, ALBUM_ROW_SIZE))
  const continueRecords = computed(() => continueListening(history.value, CONTINUE_SIZE))
  const continueIds = computed(() => continueRecords.value.map((record) => record.songId))
  const favoriteIds = computed(() => favorites.value.map((record) => record.songId))
  const albumIds = computed(() => tasteAlbums.value.map((record) => record.albumId))

  const continueQuery = useQuery<Entity[]>({
    key: () => {
      const id = userId.value
      if (id === null || continueIds.value.length === 0) return null
      return homeKeys(id).songs('history:' + idScope(continueIds.value))
    },
    fetcher: (signal) => fetchByIds('songs', continueIds.value, signal),
    staleTime: STALE_TIME,
  })

  const favoriteQuery = useQuery<Entity[]>({
    key: () => {
      const id = userId.value
      if (id === null || favoriteIds.value.length === 0) return null
      return homeKeys(id).songs('favorites:' + idScope(favoriteIds.value))
    },
    fetcher: (signal) => fetchByIds('songs', favoriteIds.value, signal),
    staleTime: STALE_TIME,
  })

  const albumQuery = useQuery<Entity[]>({
    key: () => {
      const id = userId.value
      if (id === null || albumIds.value.length === 0) return null
      return homeKeys(id).albums(idScope(albumIds.value))
    },
    fetcher: (signal) => fetchByIds('albums', albumIds.value, signal),
    staleTime: STALE_TIME,
  })

  const latestParams: QueryParams = { sort: 'latest', page: 1, page_size: SONG_ROW_SIZE }
  const latestQuery = useQuery<Page<Entity>>({
    key: () => {
      const id = userId.value
      return id === null ? null : homeKeys(id).songs('latest')
    },
    fetcher: (signal) => catalogApi.page('songs', latestParams, signal),
    staleTime: STALE_TIME,
  })

  const randomQuery = useQuery<Page<Entity>>({
    key: () => {
      const id = userId.value
      return id === null ? null : homeKeys(id).songs('random:' + page.value)
    },
    fetcher: (signal) =>
      catalogApi.page('songs', { page: page.value, page_size: SONG_ROW_SIZE }, signal),
    staleTime: STALE_TIME,
  })

  const artistQueries = Array.from({ length: ARTIST_SLOTS }, (_, index) =>
    useQuery<Page<Entity>>({
      key: () => {
        const id = userId.value
        const artist = tasteArtists.value[index]
        if (id === null || !artist) return null
        return homeKeys(id).songs('artist:' + artist.artistId)
      },
      fetcher: (signal) => {
        const artist = tasteArtists.value[index]
        if (!artist) throw new Error('缺少艺人参数')
        return catalogApi.page(
          'songs',
          { artist_id: artist.artistId, page: 1, page_size: ARTIST_ROW_SIZE },
          signal,
        )
      },
      staleTime: STALE_TIME,
    }),
  )

  // key 里已经包含了全部输入（用户、页码、id 列表）：依赖变了就重取，key 为 null 时 run 内部直接返回
  function autoRun(query: { run: (force?: boolean) => Promise<void> }, deps: () => unknown) {
    watch(deps, () => void query.run(), { immediate: true })
  }
  autoRun(continueQuery, () => [userId.value, continueIds.value.join(',')])
  autoRun(favoriteQuery, () => [userId.value, favoriteIds.value.join(',')])
  autoRun(albumQuery, () => [userId.value, albumIds.value.join(',')])
  autoRun(latestQuery, () => userId.value)
  autoRun(randomQuery, () => [userId.value, page.value])
  function runArtists() {
    return Promise.all(artistQueries.map((query) => query.run())).then(() => undefined)
  }
  autoRun({ run: () => runArtists() }, () =>
    tasteArtists.value.map((artist) => artist.artistId).join(','),
  )

  const rows = computed<HomeRow[]>(() => {
    const list: HomeRow[] = []

    const continueSongs = continueQuery.data.value
    if (continueSongs && continueSongs.length > 0) {
      const hints: Record<string, string> = {}
      for (const record of continueRecords.value) {
        const match = continueSongs.find((song) => song.id === record.songId)
        hints[record.songId] = progressLabel(record.position, match?.duration ?? null)
      }
      list.push({
        key: 'continue',
        title: '继续听',
        subtitle: '接着上次听到的地方',
        songs: continueSongs,
        albums: [],
        hints,
        playLabel: '全部播放：继续听',
      })
    }

    tasteArtists.value.forEach((artist, index) => {
      const data = artistQueries[index].data.value
      if (!data) return
      const songs = unheardSongs(data.items, history.value)
      if (songs.length < ARTIST_ROW_MIN) return
      list.push({
        key: 'artist:' + artist.artistId,
        title: '猜你喜欢',
        subtitle: '因为你在听 ' + artist.artistName,
        songs,
        albums: [],
        hints: {},
        playLabel: '全部播放：猜你喜欢（' + artist.artistName + '）',
      })
    })

    const latest = latestQuery.data.value
    if (latest && latest.items.length > 0)
      list.push({
        key: 'latest',
        title: '最近加入',
        subtitle: '曲库里最新入库的曲目',
        songs: latest.items,
        albums: [],
        hints: {},
        playLabel: '全部播放：最近加入',
      })

    const albums = albumQuery.data.value
    if (albums && albums.length > 0)
      list.push({
        key: 'albums',
        title: '常听专辑',
        subtitle: '按本机播放次数排序',
        songs: [],
        albums,
        hints: {},
      })

    const random = randomQuery.data.value
    if (random && random.items.length > 0)
      list.push({
        key: 'random',
        title: '随机漫游',
        subtitle: '第 ' + page.value + ' 页随机曲目',
        songs: random.items,
        albums: [],
        hints: {},
        playLabel: '全部播放：随机漫游',
        reshuffle: true,
      })

    const favoriteSongs = favoriteQuery.data.value
    if (favoriteSongs && favoriteSongs.length > 0)
      list.push({
        key: 'favorites',
        title: '你的收藏',
        subtitle: '本机记录的收藏',
        songs: favoriteSongs,
        albums: [],
        hints: {},
        playLabel: '全部播放：你的收藏',
      })

    return list
  })

  const queries = [continueQuery, favoriteQuery, albumQuery, latestQuery, randomQuery]
  const busy = computed(
    () => queries.some((query) => query.busy.value) || artistQueries.some((q) => q.busy.value),
  )
  const error = computed(() => {
    const messages = [...queries, ...artistQueries]
      .map((query) => query.error.value)
      .filter((message) => message.length > 0)
    return messages.length > 0 ? messages[0] : ''
  })

  /** 卡片点击：这一层整体成为队列，从点的那一首开始播 */
  function playRow(row: HomeRow, index = 0) {
    if (row.songs.length === 0) return
    void player.playList(row.songs, index, row.title)
  }

  /** 换一批：换一个随机页（key 跟着变，自然重新请求） */
  function reshuffle() {
    page.value = randomPage()
  }

  function refresh() {
    refreshLocal()
    for (const query of queries) void query.run(true)
    void runArtists()
  }

  return { rows, busy, error, playRow, reshuffle, refresh }
}
