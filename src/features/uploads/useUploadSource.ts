import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { useRoute } from 'vue-router'
import { useDropZone } from '@vueuse/core'
import { useUploadsStore } from '@/stores/uploads'
import { useSignStore } from '@/stores/sign'
import type { Entity } from '@/types/catalog'
import { notify, report, useAction } from '@/composables/useFeedback'
import { useQuery } from '@/lib/query'
import { useFolderUpload } from './useFolderUpload'
import { droppedFiles } from './droppedFiles'

export function useUploadSource() {
  const uploads = useUploadsStore()
  const sign = useSignStore()
  const route = useRoute()
  const { busy, run } = useAction()
  const dropZone = useTemplateRef<HTMLElement>('dropZone')
  const accepted = ref(false)
  const folderUpload = reactive(useFolderUpload())
  const folderBusy = ref(false)
  // 目标歌曲是「按 id 取一条」的读：key、取消、缓存都交给查询层
  const target = useQuery<{ item: Entity }>({
    key: () => (sign.user && songId() ? `${sign.user.id}:upload-target:songs:${songId()}` : null),
    fetcher: (signal) => catalogApi.item('songs', songId(), signal),
    staleTime: 30_000,
    onError: report,
  })
  // 数据不属于当前 ?song= 时视为未载入：切换歌曲立即清空，和原来的手动重置一致
  const targetSong = computed<Entity | undefined>(() => {
    const item = target.data.value?.item
    return item && item.id === songId() ? item : undefined
  })
  const hasNotice = computed(() => sign.user?.notice_version === sign.config?.notice.version)
  const accept = computed(() =>
    [
      ...(sign.config?.audio_extensions || []),
      ...(route.query.song ? [] : sign.config?.cover_extensions || []),
    ]
      .map((e) => '.' + e)
      .join(','),
  )
  function songId() {
    return typeof route.query.song === 'string' ? route.query.song : ''
  }
  async function confirmFolder() {
    folderBusy.value = true
    try {
      if (await add(folderUpload.files(), true)) folderUpload.open = false
    } finally {
      folderBusy.value = false
    }
  }
  async function add(files: File[] | FileList, confirmed = false) {
    if (!hasNotice.value) {
      report(new Error('请先阅读并同意上传须知。'))
      return
    }
    if (route.query.song && !targetSong.value) {
      report(new Error('目标歌曲尚未载入，请刷新后重试。'))
      return
    }
    if (!confirmed && Array.from(files).some((file) => file.webkitRelativePath.includes('/'))) {
      folderUpload.show(Array.from(files), !!route.query.song)
      return false
    }
    try {
      const skipped = await uploads.add(files, { song: targetSong.value })
      if (skipped) notify(`已略过 ${skipped} 个格式不支持、空文件或超出上限的文件。`)
      return true
    } catch (e) {
      report(e)
      return false
    }
  }
  async function choose(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files) await add(input.files)
    input.value = ''
  }
  async function acceptNotice() {
    await run(async () => {
      await sign.acceptNotice()
      notify('已确认上传须知，可以上传文件。')
    })
  }

  const { isOverDropZone } = useDropZone(dropZone, {
    onDrop: (_files, event) => {
      void dropped(event)
    },
  })
  async function dropped(event: DragEvent) {
    try {
      await add(await droppedFiles(event))
    } catch (error) {
      report(error)
    }
  }
  // ?song= 变化就重新取一次：同一 key 上只保留最新一次请求
  watch(
    () => route.query.song,
    () => void target.run(),
    { immediate: true },
  )

  return {
    busy,
    accepted,
    targetSong,
    hasNotice,
    accept,
    isOverDropZone,
    folderUpload,
    folderBusy,
    choose,
    confirmFolder,
    acceptNotice,
  }
}
