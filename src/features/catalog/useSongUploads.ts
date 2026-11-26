import { computed, ref, watch } from 'vue'
import { useSignStore } from '@/stores/sign'
import { useUploadsStore } from '@/stores/uploads'
import { notify, report, useAction } from '@/composables/useFeedback'
import { ACTIVE_UPLOAD_STATES, isUploadDone, UPLOAD_STATES } from '@/features/uploads/model'
import type { useEntityDetail } from './useEntityDetail'

export function useSongUploads(detail: ReturnType<typeof useEntityDetail>) {
  const { id, item, type, load } = detail
  const sign = useSignStore()
  const uploads = useUploadsStore()
  const { busy, run } = useAction()
  const uploadOpen = ref(false)
  const uploadAccepted = ref(false)
  const addingFiles = ref(false)
  const audioInput = ref<HTMLInputElement>()
  const hasNotice = computed(
    () => !!sign.config && sign.user?.notice_version === sign.config.notice.version,
  )
  // 后端配置缺字段时不能让整页渲染崩掉（dev 下会中断整棵子树）
  const audioAccept = computed(() =>
    (sign.config?.audio_extensions ?? []).map((extension) => `.${extension}`).join(','),
  )
  const songUploads = computed(() =>
    uploads.tasks.filter((task) => task.metadata.targetSongId === id),
  )
  const uploadingCount = computed(
    () => songUploads.value.filter((task) => ACTIVE_UPLOAD_STATES.includes(task.state)).length,
  )
  const unfinishedUploadCount = computed(
    () => songUploads.value.filter((task) => !isUploadDone(task)).length,
  )
  const uploadStates = { ...UPLOAD_STATES, published: '已加入歌曲' }
  watch(
    () =>
      songUploads.value
        .filter((task) => task.state === 'published')
        .map((task) => task.transfer.file?.id)
        .join(','),
    () => {
      if (item.value && type === 'songs') void load()
    },
  )
  async function chooseAudio(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files || [])
    input.value = ''
    if (!item.value || !files.length || !hasNotice.value) return
    addingFiles.value = true
    try {
      const skipped = await uploads.add(files, { song: { id, name: item.value.name } })
      notify(
        skipped
          ? `已略过 ${skipped} 个格式不支持、空文件或超出上限的文件。`
          : '已加入上传队列，完成后自动加入这首歌曲。',
      )
    } catch (e) {
      report(e)
    } finally {
      addingFiles.value = false
    }
  }
  async function acceptUploadNotice() {
    await run(async () => {
      await sign.acceptNotice()
    })
  }

  return {
    uploads,
    busy,
    uploadOpen,
    uploadAccepted,
    addingFiles,
    audioInput,
    hasNotice,
    audioAccept,
    songUploads,
    uploadingCount,
    unfinishedUploadCount,
    uploadStates,
    chooseAudio,
    acceptUploadNotice,
  }
}
