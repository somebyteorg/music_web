import { computed, inject, ref, type ComputedRef, type InjectionKey } from 'vue'
import type { AlbumPosition, Entity } from '@/types/catalog'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'
import { catalogApi } from '@/lib/api/catalog'
import { notify, report } from '@/composables/useFeedback'
import { audioFileCount } from '@/utils/audio'

/** SongList 的对外契约：页面只传这些，拆出的子组件也只读它。 */
export interface SongListProps {
  items: Entity[]
  selectable?: boolean
  selected?: string[]
  offset?: number
  disabled?: boolean
  editable?: boolean
  trackNumbers?: boolean
  albumContextId?: string
  label?: string
}

/** withDefaults 之后 offset / editable / label 一定有值，控制器按解析后的类型读。 */
export type ResolvedSongListProps = SongListProps & {
  offset: number
  editable: boolean
  label: string
}

/** 行内交互统一回到 SongList 的 emits，控制器不直接决定对外事件。 */
export interface SongListActions {
  select: (id: string) => void
  selectAll: (selected: boolean) => void
  favorite: (id: string, value: boolean) => void
  edit: (song: Entity) => void
}

/** #actions 插槽的透传参数，与拆分前保持一致。 */
export interface SongListRowActions {
  song: Entity
  index: number
}

/**
 * 控制器：行 key、音频/曲序判断、收藏中状态与播放/入队动作只在这里算一次，
 * 表头、行与默认操作共用同一份，避免各自复制列表规则。
 */
export interface SongListController {
  props: ResolvedSongListProps
  player: ReturnType<typeof usePlayerStore>
  queue: ReturnType<typeof useQueueStore>
  allSelected: ComputedRef<boolean>
  someSelected: ComputedRef<boolean>
  rowKey: (song: Entity) => string
  hasAudio: (song: Entity) => boolean
  position: (song: Entity) => AlbumPosition | undefined
  artistNames: (song: Entity) => string
  isFavoriting: (song: Entity) => boolean
  favorite: (song: Entity) => Promise<void>
  play: (song: Entity, index: number) => void
  enqueue: (song: Entity) => void
  playNext: (song: Entity) => void
  toggle: (song: Entity) => void
  toggleAll: (selected: boolean) => void
  edit: (song: Entity) => void
}

export function createSongListController(
  props: ResolvedSongListProps,
  actions: SongListActions,
): SongListController {
  const player = usePlayerStore()
  const queue = useQueueStore()
  const favoriting = ref(new Set<string>())

  function rowKey(song: Entity) {
    return song.entry_id || song.id
  }
  const allSelected = computed(
    () =>
      props.items.length > 0 && props.items.every((song) => props.selected?.includes(rowKey(song))),
  )
  const someSelected = computed(
    () => !allSelected.value && props.items.some((song) => props.selected?.includes(rowKey(song))),
  )
  function hasAudio(song: Entity) {
    const count = audioFileCount(song)
    return song.available !== false && count !== undefined && count > 0
  }
  function position(song: Entity) {
    return song.albums?.find((album) => album.id === props.albumContextId)?.pivot
  }
  function artistNames(song: Entity) {
    return song.artists?.map((artist) => artist.name).join(' / ') || '未填写歌手'
  }
  async function favorite(song: Entity) {
    if (favoriting.value.has(song.id)) return
    favoriting.value.add(song.id)
    const value = !song.is_favorite
    try {
      await catalogApi.favorite(song.id, value)
      actions.favorite(song.id, value)
    } catch (e) {
      report(e)
    } finally {
      favoriting.value.delete(song.id)
    }
  }
  function play(song: Entity, index: number) {
    if (queue.isCurrent(song.id)) {
      void player.toggle()
      return
    }
    // 点哪一首，就把当前这份列表整体变成播放队列。
    void player.playList(props.items, index, props.label)
  }
  function enqueue(song: Entity) {
    queue.append([song])
    notify(`已加入队列：${song.name}`)
  }
  function playNext(song: Entity) {
    queue.insertNext([song])
    notify(`下一首播放：${song.name}`)
  }

  return {
    props,
    player,
    queue,
    allSelected,
    someSelected,
    rowKey,
    hasAudio,
    position,
    artistNames,
    isFavoriting: (song) => favoriting.value.has(song.id),
    favorite,
    play,
    enqueue,
    playNext,
    toggle: (song) => actions.select(rowKey(song)),
    toggleAll: (selected) => actions.selectAll(selected),
    edit: (song) => actions.edit(song),
  }
}

export const songListContextKey: InjectionKey<SongListController> = Symbol('songListContext')

export function useSongListContext() {
  const context = inject(songListContextKey)
  if (!context) throw new Error('歌曲列表子组件缺少上下文（songListContextKey）')
  return context
}
