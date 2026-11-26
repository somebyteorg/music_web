import { computed, reactive, ref, useTemplateRef, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { useRoute } from 'vue-router'
import { useDropZone } from '@vueuse/core'
import { useUploadsStore } from '@/stores/uploads'
import { useSignStore } from '@/stores/sign'
import type { Entity } from '@/types/catalog'
import { notify, report, useAction } from '@/composables/useFeedback'
import { useLatestRequest } from '@/composables/useLatestRequest'
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
  const request = useLatestRequest()
  const targetSong = ref<Entity>()
  const hasNotice = computed(() => sign.user?.notice_version === sign.config?.notice.version)
  const accept = computed(() =>
    [
      ...(sign.config?.audio_extensions || []),
      ...(route.query.song ? [] : sign.config?.cover_extensions || []),
    ]
      .map((e) => '.' + e)
      .join(','),
  )
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
  watch(
    () => route.query.song,
    async (id) => {
      const signal = request.start()
      targetSong.value = undefined
      if (typeof id !== 'string') return
      try {
        const result = await catalogApi.item('songs', id, signal)
        if (!signal.aborted) targetSong.value = result.item
      } catch (error) {
        if (!signal.aborted) report(error)
      }
    },
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
