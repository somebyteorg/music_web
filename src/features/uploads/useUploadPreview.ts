import { ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { useRoute } from 'vue-router'
import type { Entity } from '@/types/catalog'
import { useUploadsStore } from '@/stores/uploads'
import { notify, report, useAction } from '@/composables/useFeedback'
import { useLatest } from '@/lib/query'
import { uploadRepository } from './repository'
import type { UploadTask } from './model'

type SongChoice = Pick<Entity, 'id' | 'name' | 'artists' | 'albums' | 'recording_version'>

export function useUploadPreview(
  organize: (tasks: UploadTask[]) => void,
  onPublished: () => Promise<void>,
) {
  const uploads = useUploadsStore()
  const route = useRoute()
  // 弹窗预览与搜索都是一次性的：不缓存，只要「只保留最新一次」
  const previewRequest = useLatest()
  const searchRequest = useLatest({ onError: report })
  const { busy, run } = useAction()
  const selected = ref<UploadTask>()
  const confirm = ref(false)
  const previewOnly = ref(false)
  const query = ref('')
  const candidates = ref<Entity[]>([])
  const song = ref<SongChoice>()

  watch(confirm, (open) => {
    if (!open) {
      previewRequest.cancel()
      searchRequest.cancel()
    }
  })

  async function open(task: UploadTask, onlyPreview = false) {
    if (!onlyPreview && !route.query.song) {
      organize([task])
      return
    }
    searchRequest.cancel()
    selected.value = task
    previewOnly.value = onlyPreview
    song.value = undefined
    candidates.value = []
    query.value = task.metadata.title || task.name
    confirm.value = true
    // 预览图与目标歌曲共用一次请求：取消后两个环节都不再写回
    await previewRequest.run(async (signal) => {
      try {
        if (task.transfer.file && !task.transfer.file.preview) {
          const result = await uploadRepository.previewFiles([task.transfer.file.id], signal)
          if (signal.aborted) return
          const file = result.files[0]
          if (file) task.transfer.file = { ...file, metadata: null }
        }
      } catch (error) {
        if (!signal.aborted) report(error)
      }
      if (signal.aborted || typeof route.query.song !== 'string') return
      try {
        const result = await catalogApi.item('songs', route.query.song, signal)
        if (!signal.aborted) song.value = result.item
      } catch (error) {
        if (!signal.aborted) report(error)
      }
    })
  }

  async function search() {
    const outcome = await searchRequest.run((signal) =>
      catalogApi.page('songs', { q: query.value, page_size: 20 }, signal),
    )
    if (outcome.status === 'done') candidates.value = outcome.data.items
  }

  function chooseSong(candidate: SongChoice) {
    song.value = candidate
  }

  async function publish() {
    await run(async () => {
      if (!selected.value?.transfer.file || !song.value) return
      await uploads.publish(selected.value, { song_id: song.value.id })
      confirm.value = false
      notify('音频已加入曲库。')
      await onPublished()
    })
  }

  return {
    selected,
    confirm,
    previewOnly,
    query,
    candidates,
    song,
    busy,
    open,
    search,
    chooseSong,
    publish,
  }
}
