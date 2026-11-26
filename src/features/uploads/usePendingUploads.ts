import { computed, ref } from 'vue'
import { filesApi } from '@/lib/api/files'
import type { AudioFile } from '@/types/uploads'
import { useUploadsStore } from '@/stores/uploads'
import { report } from '@/composables/useFeedback'
import { useLatestRequest } from '@/composables/useLatestRequest'

export function usePendingUploads() {
  const uploads = useUploadsStore()
  const request = useLatestRequest()
  const pending = ref<AudioFile[]>([])
  const pendingBusy = ref(false)
  const pendingPage = ref(1)
  const pendingTotal = ref(0)
  const pendingPageSize = ref(24)
  const remotePending = computed(() =>
    pending.value.filter((file) => !uploads.tasks.some((task) => task.file?.id === file.id)),
  )

  async function loadPending() {
    const signal = request.start()
    pendingBusy.value = true
    try {
      while (!signal.aborted) {
        const result = await filesApi.page(
          { pending: 1, kind: 'audio', page: pendingPage.value },
          signal,
        )
        if (signal.aborted) return
        const lastPage = Math.max(1, Math.ceil(result.total / result.page_size))
        if (pendingPage.value > lastPage) {
          pendingPage.value = lastPage
          continue
        }
        pending.value = result.items
        pendingTotal.value = result.total
        pendingPageSize.value = result.page_size
        break
      }
    } catch (error) {
      if (!signal.aborted) report(error)
    } finally {
      if (!signal.aborted) pendingBusy.value = false
    }
  }

  function changePendingPage(page: number) {
    pendingPage.value = page
    void loadPending()
  }

  return {
    remotePending,
    pendingBusy,
    pendingPage,
    pendingTotal,
    pendingPageSize,
    loadPending,
    changePendingPage,
  }
}
