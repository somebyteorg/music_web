import { onBeforeUnmount, ref } from 'vue'
import { filesApi } from '@/lib/api/files'
import type { AudioFile } from '@/types/uploads'
import { notify } from './useFeedback'

export function useImageLibrary(onDeleted: (id: string) => void) {
  const open = ref(false)
  const items = ref<AudioFile[]>([])
  const query = ref('')
  const page = ref(1)
  const pageSize = ref(24)
  const total = ref(0)
  const busy = ref(false)
  const error = ref('')
  const preview = ref<{ id: string; name: string; file?: AudioFile; url?: string }>()
  const previewOpen = ref(false)
  const previewBusy = ref(false)
  const previewError = ref('')
  const references = ref<string[]>([])
  const confirmDelete = ref(false)
  let controller: AbortController | undefined
  let previewController: AbortController | undefined
  async function load(target = 1) {
    controller?.abort()
    const request = new AbortController()
    controller = request
    busy.value = true
    error.value = ''
    try {
      const result = await filesApi.page(
        { kind: 'cover', active: 1, page: target, q: query.value.trim() },
        request.signal,
      )
      items.value = result.items
      page.value = result.page
      pageSize.value = result.page_size
      total.value = result.total
      const last = Math.max(1, Math.ceil(result.total / result.page_size))
      if (target > last) await load(last)
    } catch (e) {
      if (!request.signal.aborted) error.value = e instanceof Error ? e.message : '获取图片失败。'
    } finally {
      if (!request.signal.aborted) busy.value = false
    }
  }
  function show() {
    query.value = ''
    open.value = true
    void load()
  }
  async function inspect(picture: { id: string; name: string; file?: AudioFile; url?: string }) {
    previewController?.abort()
    const request = new AbortController()
    previewController = request
    preview.value = picture
    previewOpen.value = true
    references.value = []
    previewError.value = ''
    confirmDelete.value = false
    previewBusy.value = !!picture.file
    if (!picture.file) return
    try {
      const result = await filesApi.image(picture.id, request.signal)
      if (request.signal.aborted) return
      preview.value = { ...picture, file: result.file }
      references.value = result.references
    } catch (e) {
      if (!request.signal.aborted)
        previewError.value = e instanceof Error ? e.message : '获取图片资料失败。'
    } finally {
      if (!request.signal.aborted) previewBusy.value = false
    }
  }
  async function remove() {
    const file = preview.value?.file
    if (!file || !confirmDelete.value || previewBusy.value || references.value.length) return
    previewBusy.value = true
    previewError.value = ''
    try {
      await filesApi.remove(file.id, { updated_at: file.updated_at })
      onDeleted(file.id)
      previewOpen.value = false
      notify('图片已删除。')
      if (open.value) await load(page.value)
    } catch (e) {
      previewError.value = e instanceof Error ? e.message : '删除图片失败。'
      confirmDelete.value = false
    } finally {
      previewBusy.value = false
    }
  }
  onBeforeUnmount(() => {
    controller?.abort()
    previewController?.abort()
  })
  return {
    open,
    items,
    query,
    page,
    pageSize,
    total,
    busy,
    error,
    load,
    show,
    preview,
    previewOpen,
    previewBusy,
    previewError,
    references,
    confirmDelete,
    inspect,
    remove,
  }
}
