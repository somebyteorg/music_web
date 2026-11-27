import { catalogLabels as labels } from '@/features/catalog/config'
import { catalogApi } from '@/lib/api/catalog'
import { computed, reactive, ref, type Ref, watch } from 'vue'
import type { AudioFile } from '@/types/uploads'
import type { Entity, Person } from '@/types/catalog'
import type { User } from '@/types/session'
import { useImageLibrary } from '@/composables/useImageLibrary'
import { fileUrl } from '@/utils/file'
import { useLibrariesStore } from '@/stores/libraries'
import { notify, report, useAction } from '@/composables/useFeedback'
import { useUploadsStore } from '@/stores/uploads'
import { useSignStore } from '@/stores/sign'
import { type AlbumEntry, buildEntityPayload, createEditorForm, type EditorProps } from './model'
import { communityApi } from '@/lib/api/community'
import { invalidateScopes } from '@/lib/query/keys'

export function useEntityEditor(
  props: EditorProps,
  open: Ref<boolean>,
  onSaved: (item: Entity) => void,
) {
  const trackMode = computed(() => props.tracks !== undefined && !props.libraryMode)
  const libraries = useLibrariesStore()
  const albumEntries = ref<AlbumEntry[]>([])
  const trackRows = ref<
    { song: Entity; disc_number: number; track_number: number; remove: boolean }[]
  >([])
  const assignmentChosen = ref(false)
  const albumSelectionName = ref('')
  const assignmentReason = ref('')
  const recordingQuery = ref('')
  const recordingOptions = ref<Entity[]>([])
  const recordingSongId = ref('')
  const { busy, run } = useAction()
  const uploads = useUploadsStore()
  const sign = useSignStore()
  const form = ref(createEditorForm(props))
  const artists = ref<Person[]>([])
  const artwork = ref<NonNullable<Entity['artwork']>>([])
  const members = ref<User[]>([])
  const query = ref('')
  const options = ref<Person[]>([])
  const albumOptions = ref<Entity[]>([])
  const albumQuery = ref('')
  const memberQuery = ref('')
  const memberOptions = ref<User[]>([])
  const uploading = ref(false)
  const images = reactive(
    useImageLibrary((id) => {
      if (form.value.cover_id === id) form.value.cover_id = null
      void uploads.forgetFile(id)
    }),
  )
  const coverInput = ref<HTMLInputElement>()
  const coverError = ref('')
  const coverMessage = ref('')
  function selectCover(file: AudioFile) {
    form.value.cover_id = file.id
    images.open = false
    images.previewOpen = false
    coverMessage.value = '已选择图片，保存资料后生效。'
  }
  const coverSource = computed(() => {
    if (form.value.cover_id) return fileUrl(form.value.cover_id)
    return props.item?.image_url || null
  })
  const title = computed(() =>
    props.libraryMode
      ? '批量调整媒体库'
      : trackMode.value
        ? props.album
          ? '管理专辑曲目'
          : '批量加入专辑'
        : `${props.item ? '编辑' : '新建'}${labels[props.type]}`,
  )
  watch(open, (value) => {
    if (!value) return
    const e = props.item
    assignmentChosen.value = !!props.album
    assignmentReason.value = ''
    trackRows.value = (props.tracks || []).map((song, index) => ({
      song,
      disc_number:
        song.albums?.find((album) => album.id === props.album?.id)?.pivot?.disc_number || 1,
      track_number:
        song.albums?.find((album) => album.id === props.album?.id)?.pivot?.track_number ||
        index + 1,
      remove: false,
    }))
    recordingSongId.value = ''
    recordingQuery.value = ''
    recordingOptions.value = []
    form.value = createEditorForm(props)
    artists.value = [...(e?.artists || [])]
    artwork.value = (e?.artwork || []).map((picture) => ({ ...picture }))
    members.value = [...(e?.collaborators || [])]
    albumEntries.value = (e?.albums || []).map((album) => ({
      album,
      disc_number: album.pivot?.disc_number || 1,
      track_number: album.pivot?.track_number || 1,
    }))
    void libraries.load().then(() => {
      if (open.value && !props.libraryMode && !form.value.library_id)
        form.value.library_id = libraries.defaultId
    })
    albumSelectionName.value = props.album?.name || ''
    albumQuery.value = albumSelectionName.value
    albumOptions.value = []
    query.value = ''
    options.value = []
    memberOptions.value = []
    coverError.value = ''
    coverMessage.value = ''
    images.open = false
    images.previewOpen = false
  })
  watch(albumQuery, (value) => {
    if (trackMode.value && value !== albumSelectionName.value) assignmentChosen.value = false
  })
  function pickAlbum(album: Entity) {
    if (trackMode.value) {
      form.value.album_id = album.id
      albumSelectionName.value = album.name
      albumQuery.value = album.name
      assignmentChosen.value = true
    } else if (!albumEntries.value.some((entry) => entry.album.id === album.id)) {
      albumEntries.value.push({ album, disc_number: 1, track_number: (album.songs_count || 0) + 1 })
      albumQuery.value = ''
    }
    albumOptions.value = []
  }
  async function search(kind: 'artists' | 'albums' | 'members') {
    try {
      if (kind === 'members') {
        const r = await communityApi.members<User>({ q: memberQuery.value })
        memberOptions.value = r.items.filter((m) => m.id !== sign.user?.id)
        return
      }
      const q = kind === 'artists' ? query.value : albumQuery.value
      const r = await catalogApi.page(kind, { q, page_size: 12 })
      if (kind === 'artists') options.value = r.items
      else albumOptions.value = r.items
    } catch (e) {
      report(e)
    }
  }
  async function cover(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    coverError.value = ''
    coverMessage.value = ''
    if (sign.user?.notice_version !== sign.config?.notice.version) {
      coverError.value = '请先在上传文件页确认上传须知，再上传封面。'
      return
    }
    uploading.value = true
    try {
      selectCover(await uploads.cover(file))
      coverMessage.value = '封面已上传，保存资料后生效。'
    } catch (e) {
      coverError.value = e instanceof Error ? e.message : '封面上传失败，请重试。'
    } finally {
      uploading.value = false
    }
  }
  async function searchRecordings() {
    try {
      recordingOptions.value = (
        await catalogApi.page('songs', { q: recordingQuery.value, page_size: 12 })
      ).items.filter((song) => song.id !== props.item?.id)
    } catch (e) {
      report(e)
    }
  }
  function numberTracks() {
    const counters = new Map<number, number>()
    for (const row of trackRows.value) {
      if (row.remove) continue
      const next = (counters.get(row.disc_number) || 0) + 1
      counters.set(row.disc_number, next)
      row.track_number = next
    }
  }
  /** 保存成功后的统一收尾：编辑影响列表与详情两块，按前缀失效后由各页自己的 query 重取 */
  function done(item: Entity) {
    invalidateScopes(sign.user?.id, ['catalog', 'detail'])
    open.value = false
    onSaved(item)
  }

  async function save() {
    await run(async () => {
      if (props.libraryMode) {
        if (!form.value.library_id || !props.tracks?.length) throw new Error('请选择目标媒体库。')
        await catalogApi.assignLibrary({
          library_id: form.value.library_id,
          items: props.tracks.map((song) => ({ id: song.id, version: song.version })),
          reason: assignmentReason.value,
        })
        notify('歌曲所属媒体库已更新。')
        done(props.tracks[0]!)
        return
      }
      if (trackMode.value) {
        if (!assignmentChosen.value || !trackRows.value.length)
          throw new Error('请选择专辑，或选择作为单曲。')
        await catalogApi.assignAlbum({
          album_id: form.value.album_id,
          items: trackRows.value.map((row) => ({
            id: row.song.id,
            version: row.song.version,
            disc_number: row.disc_number,
            track_number: row.track_number,
            remove: row.remove,
          })),
          reason: assignmentReason.value,
        })
        notify('专辑归属和曲序已更新。')
        done(props.album || props.tracks![0]!)
        return
      }
      const body = buildEntityPayload(
        props.type,
        {
          form: form.value,
          artists: artists.value,
          artwork: artwork.value,
          members: members.value,
          albumEntries: albumEntries.value,
          recordingSongId: recordingSongId.value,
        },
        props.item,
      )
      const result = await catalogApi.save(props.type, body, props.item?.id)
      // 写操作只标脏：缓存作废，随后的读取把新列表取回来
      if (props.type === 'libraries') {
        libraries.invalidate()
        await libraries.load()
      }
      notify('保存成功。')
      done(result.item)
    })
  }

  return {
    trackMode,
    libraries,
    albumEntries,
    trackRows,
    assignmentChosen,
    albumSelectionName,
    assignmentReason,
    recordingQuery,
    recordingOptions,
    recordingSongId,
    busy,
    form,
    artists,
    artwork,
    members,
    query,
    options,
    albumOptions,
    albumQuery,
    memberQuery,
    memberOptions,
    uploading,
    images,
    coverInput,
    coverError,
    coverMessage,
    selectCover,
    coverSource,
    title,
    pickAlbum,
    search,
    cover,
    searchRecordings,
    numberTracks,
    save,
  }
}
