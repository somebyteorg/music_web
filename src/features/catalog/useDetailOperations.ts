import { computed, ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { useRouter } from 'vue-router'
import { filesApi } from '@/lib/api/files'
import type { Entity } from '@/types/catalog'
import type { AudioFile } from '@/types/uploads'
import { notify, useAction } from '@/composables/useFeedback'
import { useSignStore } from '@/stores/sign'
import { invalidateScopes } from '@/lib/query/keys'
import type { useEntityDetail } from './useEntityDetail'

type DetailOperation =
  | ''
  | 'delete'
  | 'merge'
  | 'file-delete'
  | 'file-move'
  | 'tracks'
  | 'playlist-move'
  | 'playlist-private'

export function useDetailOperations(detail: ReturnType<typeof useEntityDetail>) {
  const { type, id, backTo, item, songs, tracksStatus, page, total, songPageSize, load } = detail
  const router = useRouter()
  const sign = useSignStore()
  const { busy, run } = useAction()
  const operation = ref<DetailOperation>('')
  const reason = ref('')
  const targetQuery = ref('')
  const targets = ref<Entity[]>([])
  const target = ref<Entity | null>(null)
  const selectedFile = ref<AudioFile>()
  const trackDraft = ref<Entity[]>([])
  const selectedEntries = ref<string[]>([])
  const managingTracks = ref(false)
  const movingEntry = ref<Entity>()
  const movePosition = ref(1)
  const canEdit = computed(() =>
    type === 'libraries' ? sign.isAdmin : type !== 'playlists' || !!item.value?.can_edit_metadata,
  )
  // 曲目 ready 后才读 songs；首帧、加载中与错误态都不触发清空
  watch(
    () => (tracksStatus.value === 'ready' ? songs.value : null),
    () => {
      selectedEntries.value = []
    },
  )
  function openOperation(mode: typeof operation.value, file?: AudioFile) {
    operation.value = mode
    selectedFile.value = file
    reason.value = ''
    targetQuery.value = ''
    targets.value = []
    target.value = null
  }
  async function searchTargets() {
    await run(async () => {
      const kind = operation.value === 'merge' ? type : 'songs'
      const r = await catalogApi.page(kind, { q: targetQuery.value, page_size: 20 })
      targets.value = r.items.filter((s) => operation.value === 'tracks' || s.id !== id)
    })
  }
  async function apply() {
    await run(async () => {
      if (!item.value) return
      if (operation.value === 'delete') {
        await catalogApi.remove(type, id, { version: item.value.version, reason: reason.value })
        notify(type === 'playlists' ? '歌单已删除。' : '已删除，可从操作记录中恢复。')
        invalidateScopes(sign.user?.id, ['catalog', 'detail'])
        await router.push(`/${type}`)
      } else if (operation.value === 'playlist-private') {
        const result = await catalogApi.privatePlaylist(id)
        notify(result.message)
        invalidateScopes(sign.user?.id, ['catalog', 'detail'])
        await router.push(backTo)
      } else if (operation.value === 'merge' && target.value) {
        await catalogApi.merge(type, id, {
          target_id: target.value.id,
          version: item.value.version,
          target_version: target.value.version,
          reason: reason.value,
        })
        notify('合并成功。')
        invalidateScopes(sign.user?.id, ['catalog', 'detail'])
        await router.push(`/${type}/${target.value.id}`)
      } else if (operation.value === 'file-delete' && selectedFile.value) {
        await filesApi.remove(selectedFile.value.id, {
          reason: reason.value,
          updated_at: selectedFile.value.updated_at,
        })
        notify('资源已删除，原文件保留，可从操作记录中恢复。')
        invalidateScopes(sign.user?.id, ['detail', 'pending-uploads'])
        await load()
      } else if (operation.value === 'file-move' && selectedFile.value && target.value) {
        await filesApi.update(selectedFile.value.id, {
          song_id: target.value.id,
          updated_at: selectedFile.value.updated_at,
        })
        notify('音频已移动到所选歌曲。')
        invalidateScopes(sign.user?.id, ['detail', 'pending-uploads'])
        await load()
      } else if (operation.value === 'tracks') {
        await catalogApi.playlistAppend(
          id,
          trackDraft.value.map((s) => s.id),
        )
        page.value = Math.max(
          1,
          Math.ceil((total.value + trackDraft.value.length) / songPageSize.value),
        )
        notify('已添加到歌单。')
        invalidateScopes(sign.user?.id, ['catalog', 'detail', 'pending-uploads'])
        // 先关对话框再刷新：曲目刷新失败时不应让 operation 仍处于会读 total 的状态
        operation.value = ''
        await load()
      } else if (operation.value === 'playlist-move' && movingEntry.value?.entry_id) {
        await catalogApi.playlistMove(id, movingEntry.value.entry_id, movePosition.value)
        page.value = Math.ceil(Math.min(movePosition.value, total.value) / songPageSize.value)
        notify('曲序已调整。')
        invalidateScopes(sign.user?.id, ['detail', 'pending-uploads'])
        operation.value = ''
        await load()
      }
      operation.value = ''
    })
  }
  async function setDefault(file: AudioFile) {
    await run(async () => {
      await filesApi.update(file.id, { song_id: id, is_default: true, updated_at: file.updated_at })
      notify('系统默认音质已更新。')
      invalidateScopes(sign.user?.id, ['detail', 'pending-uploads'])
      await load()
    })
  }
  function tracks() {
    trackDraft.value = []
    openOperation('tracks')
  }
  function toggleEntry(entryId: string) {
    selectedEntries.value = selectedEntries.value.includes(entryId)
      ? selectedEntries.value.filter((id) => id !== entryId)
      : [...selectedEntries.value, entryId]
  }
  function selectPage(selected: boolean) {
    selectedEntries.value = selected
      ? songs.value.map((song) => song.entry_id!).filter(Boolean)
      : []
  }
  function moveEntry(song: Entity, index: number) {
    movingEntry.value = song
    movePosition.value = (page.value - 1) * songPageSize.value + index + 1
    openOperation('playlist-move')
  }
  async function removeEntries(entryIds: string[]) {
    await run(async () => {
      await catalogApi.playlistRemove(id, entryIds)
      page.value = Math.min(
        page.value,
        Math.max(1, Math.ceil((total.value - entryIds.length) / songPageSize.value)),
      )
      notify('已从歌单移除。')
      invalidateScopes(sign.user?.id, ['catalog', 'detail', 'pending-uploads'])
      await load()
    })
  }
  function reorder(index: number, offset: number) {
    const destination = index + offset
    if (destination < 0 || destination >= trackDraft.value.length) return
    const removed = trackDraft.value.splice(index, 1)[0]
    if (removed) trackDraft.value.splice(destination, 0, removed)
  }
  async function favorite() {
    if (!item.value) return
    await run(async () => {
      await catalogApi.favorite(id, !item.value!.is_favorite)
      item.value!.is_favorite = !item.value!.is_favorite
      // 页面上的按钮已经就地改过，失效只为让列表页回来时看到新状态
      invalidateScopes(sign.user?.id, ['catalog', 'detail'])
    })
  }

  return {
    busy,
    run,
    operation,
    reason,
    targetQuery,
    targets,
    target,
    selectedFile,
    trackDraft,
    selectedEntries,
    managingTracks,
    movingEntry,
    movePosition,
    canEdit,
    openOperation,
    searchTargets,
    apply,
    setDefault,
    tracks,
    toggleEntry,
    selectPage,
    moveEntry,
    removeEntries,
    reorder,
    favorite,
  }
}
