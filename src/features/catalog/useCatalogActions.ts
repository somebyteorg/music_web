import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import { favoriteSongs } from '@/lib/api/catalog'
import { useLibrariesStore } from '@/stores/libraries'
import { useSignStore } from '@/stores/sign'
import { notify, useAction } from '@/composables/useFeedback'
import type { Entity } from '@/types/catalog'
import type { useCatalog } from './useCatalog'
import { makePlaylistPrivate } from './api'

export function useCatalogActions(catalog: ReturnType<typeof useCatalog>) {
  const { type, items, favorites, load } = catalog
  const libraries = useLibrariesStore()
  const sign = useSignStore()
  const canCreate = computed(() => type.value !== 'libraries' || sign.isAdmin)
  const assignLibrary = ref(false)
  onMounted(() => libraries.load())
  const assignAlbum = ref(false)
  const selectedSongs = computed(() =>
    items.value.filter((song) => selected.value.includes(song.id)),
  )
  const create = ref(false)
  const editing = ref<Entity>()
  const privatePlaylist = ref<Entity>()
  const selected = ref<string[]>([])
  const { busy: acting, run } = useAction()
  const views = useStorage<Record<string, string>>('music-catalog-views', {})
  const layout = computed({
    get: () => views.value[type.value] || (type.value === 'songs' ? 'list' : 'grid'),
    set: (value: string) => {
      views.value[type.value] = value
    },
  })
  watch(items, () => {
    selected.value = []
  })
  function edit(item: Entity) {
    editing.value = item
    create.value = true
  }
  function newItem() {
    if (!canCreate.value) return
    editing.value = undefined
    create.value = true
  }
  function canMakePrivate(item: Entity) {
    return type.value === 'playlists' && sign.canModerate && !!item.is_public
  }
  async function makePrivate() {
    if (!privatePlaylist.value || !canMakePrivate(privatePlaylist.value)) return
    await run(async () => {
      const result = await makePlaylistPrivate(privatePlaylist.value!.id)
      privatePlaylist.value = undefined
      notify(result.message)
      await load()
    })
  }
  function toggle(id: string) {
    selected.value = selected.value.includes(id)
      ? selected.value.filter((value) => value !== id)
      : [...selected.value, id]
  }
  async function bulkFavorite(value: boolean) {
    await run(async () => {
      const ids = [...selected.value]
      const failed: string[] = []
      let count = 0
      for (let start = 0; start < ids.length; start += 5) {
        const batch = ids.slice(start, start + 5)
        const results = await favoriteSongs(batch, value)
        count += results.filter((result) => result.status === 'fulfilled').length
        results.forEach((result, index) => {
          if (result.status === 'rejected') failed.push(batch[index]!)
        })
      }
      notify(
        `已${value ? '收藏' : '取消收藏'} ${count} 首歌曲${count < ids.length ? `，${ids.length - count} 首未完成，请重试` : ''}。`,
        count < ids.length,
      )
      selected.value = []
      await load()
      await nextTick()
      selected.value = failed.filter((id) => items.value.some((item) => item.id === id))
    })
  }
  function favorite(id: string, value: boolean) {
    const song = items.value.find((item) => item.id === id)
    if (song) song.is_favorite = value
    if (favorites.value && !value) void load()
  }
  async function saved() {
    await load()
    if (type.value === 'libraries') await libraries.load(true)
  }

  return {
    libraries,
    canCreate,
    assignLibrary,
    assignAlbum,
    selectedSongs,
    create,
    editing,
    privatePlaylist,
    selected,
    acting,
    layout,
    edit,
    newItem,
    canMakePrivate,
    makePrivate,
    toggle,
    bulkFavorite,
    favorite,
    saved,
  }
}
