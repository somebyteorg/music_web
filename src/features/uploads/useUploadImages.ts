import { reactive, ref } from 'vue'
import { useUploadsStore } from '@/stores/uploads'
import { useSignStore } from '@/stores/sign'
import type { AudioFile } from '@/types/uploads'
import { useImageLibrary } from '@/composables/useImageLibrary'
import type { UploadTask } from './model'
import type { BatchAlbum } from './batchModel'
import type { UploadBatch } from './useUploadBatch'

export function useUploadImages(batch: UploadBatch) {
  const uploads = useUploadsStore()
  const sign = useSignStore()
  const imageAlbum = ref<BatchAlbum>()
  const imageTask = ref<UploadTask>()
  const images = reactive(
    useImageLibrary((id) => {
      batch.forgetPicture(id)
      void uploads.forgetFile(id)
    }),
  )
  function browseImages(album?: BatchAlbum) {
    imageAlbum.value = album
    imageTask.value = undefined
    images.show()
  }
  function selectImage(file: AudioFile) {
    if (!imageAlbum.value) return
    batch.pickPicture(imageAlbum.value, file)
    images.open = false
    images.previewOpen = false
  }
  function inspectPicture(picture: Parameters<typeof images.inspect>[0], album?: BatchAlbum) {
    imageTask.value = undefined
    imageAlbum.value = album
    void images.inspect(picture)
  }
  function inspectPending(file: AudioFile) {
    if (file.preview?.cover_id) inspectPicture({ id: file.preview.cover_id, name: '音频内嵌封面' })
  }
  async function removePreviewTask() {
    if (!imageTask.value) return
    await uploads.remove(imageTask.value)
    images.previewOpen = false
  }
  function selectPreview() {
    if (!images.preview || !imageAlbum.value) return
    if (images.preview.file) selectImage(images.preview.file)
    else {
      imageAlbum.value.coverChoice = images.preview.id
      images.previewOpen = false
    }
  }
  function inspectTask(task: UploadTask) {
    imageAlbum.value = undefined
    imageTask.value = task
    const file = task.transfer.file
    const id = task.kind === 'cover' ? file?.id : file?.preview?.cover_id
    if (id)
      void images.inspect({
        id,
        name: task.name,
        file: task.kind === 'cover' && file?.user_id === sign.user?.id ? file : undefined,
      })
    else if (uploads.localCover(task))
      void images.inspect({ id: task.id, name: task.name, url: uploads.localCover(task) })
  }

  return {
    imageAlbum,
    imageTask,
    images,
    browseImages,
    selectImage,
    inspectPicture,
    inspectPending,
    removePreviewTask,
    selectPreview,
    inspectTask,
  }
}
