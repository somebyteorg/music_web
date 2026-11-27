import { computed, ref, watch } from 'vue'
import { filesApi } from '@/lib/api/files'
import type { Page } from '@/types/common'
import type { AudioFile } from '@/types/uploads'
import { useUploadsStore } from '@/stores/uploads'
import { useSignStore } from '@/stores/sign'
import { report } from '@/composables/useFeedback'
import { useQuery } from '@/lib/query'
import { invalidateScopes, pendingUploadKeys } from '@/lib/query/keys'

export function usePendingUploads() {
  const uploads = useUploadsStore()
  const sign = useSignStore()
  const pendingPage = ref(1)
  const pendingTotal = ref(0)
  const pendingPageSize = ref(24)
  // 待入库是「按页取一页」的读：key 带用户与页码；staleTime 0 表示每次进入都回源
  const pending = useQuery<Page<AudioFile>>({
    key: () => (sign.user ? pendingUploadKeys(sign.user.id).page(pendingPage.value) : null),
    fetcher: (signal) =>
      filesApi.page({ pending: 1, kind: 'audio', page: pendingPage.value }, signal),
    staleTime: 0,
    onError: report,
  })
  const remotePending = computed(() => {
    const page = pending.data.value
    if (!page) throw new Error('待入库数据未就绪时访问了 remotePending')
    return page.items.filter(
      (file) => !uploads.tasks.some((task) => task.transfer.file?.id === file.id),
    )
  })
  // 页码越界（例如入库后总数变少）时收敛到最后一页，再取一次
  watch(pending.data, (page) => {
    if (!page) return
    pendingTotal.value = page.total
    pendingPageSize.value = page.page_size
    const last = Math.max(1, Math.ceil(pendingTotal.value / pendingPageSize.value))
    if (pendingPage.value <= last) return
    pendingPage.value = last
    void pending.run(false)
  })
  /** 待入库表刷新（入库完成、手动刷新）：按前缀失效后再取 */
  function loadPending() {
    invalidateScopes(sign.user?.id, ['pending-uploads'])
    return pending.run(false)
  }
  function changePendingPage(page: number) {
    pendingPage.value = page
    void pending.run(false)
  }

  return {
    remotePending,
    pendingBusy: pending.busy,
    pendingPage,
    pendingTotal,
    pendingPageSize,
    loadPending,
    changePendingPage,
  }
}
