import { ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import { useRoute } from 'vue-router'
import type { Entity } from '@/types/catalog'
import { useUploadsStore } from '@/stores/uploads'
import { notify, report, useAction } from '@/composables/useFeedback'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { uploadRepository } from './repository'
import type { UploadTask } from './model'

type SongChoice = Pick<Entity, 'id' | 'name' | 'artists' | 'albums' | 'recording_version'>

export function useUploadPreview(
  organize: (tasks: UploadTask[]) => void,
  onPublished: () => Promise<void>,
) {
  const uploads = useUploadsStore()
  const route = useRoute()
  const previewRequest = useLatestRequest()
  const searchRequest = useLatestRequest()
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
    const signal = previewRequest.start()
    searchRequest.cancel()
    selected.value = task
    previewOnly.value = onlyPreview
    song.value = undefined
    candidates.value = []
    query.value = task.title || task.name
    confirm.value = true
    try {
      if (task.file && !task.file.preview) {
        const result = await uploadRepository.previewFiles([task.file.id], signal)
        if (signal.aborted) return
        const file = result.files[0]
        if (file) task.file = { ...file, metadata: null }
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
  }

  async function search() {
    const signal = searchRequest.start()
    try {
      const result = await catalogApi.page('songs', { q: query.value, page_size: 20 }, signal)
      if (!signal.aborted) candidates.value = result.items
    } catch (error) {
      if (!signal.aborted) report(error)
    }
  }

  function chooseSong(candidate: SongChoice) {
    song.value = candidate
  }

  async function publish() {
    await run(async () => {
      if (!selected.value?.file || !song.value) return
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
