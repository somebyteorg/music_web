import type { ComputedRef, Ref } from 'vue'
import { notify } from '@/composables/useFeedback'
import type { AudioFile, PublishData } from '@/types/uploads'
import type { UploadTask } from './model'
import type { BatchAlbum } from './batchModel'
import type { PublishItem } from './batchDrafts'

interface BatchPublishingDeps {
  form: Ref<{ libraryId: string }>
  open: Ref<boolean>
  valid: ComputedRef<boolean>
  run: <T>(action: () => Promise<T>) => Promise<T | undefined>
  uploads: {
    publishMany(items: { task: UploadTask; data: PublishData }[]): Promise<void>
    cover(file: File): Promise<AudioFile>
  }
  onSaved(): Promise<void>
  drafts(): void
  publishItems(): PublishItem[]
  persistDrafts(items: PublishItem[]): Promise<void>
  pickPicture(album: BatchAlbum, file: AudioFile): void
}

/** 发布编排：校验、保存草稿、批量入库与封面上传 */
export function createBatchPublishing(deps: BatchPublishingDeps) {
  async function save() {
    await deps.run(async () => {
      if (!deps.valid.value) throw new Error('请先确认每组专辑归属，并核对歌名、碟号和曲序。')
      deps.drafts()
      await deps.persistDrafts(deps.publishItems())
      deps.open.value = false
      notify('草稿已保存，可稍后继续加入曲库。')
    })
  }

  async function publish() {
    await deps.run(async () => {
      if (!deps.valid.value) throw new Error('请先确认每组专辑归属，并核对歌名、碟号和曲序。')
      deps.drafts()
      const items = deps.publishItems()
      await deps.persistDrafts(items)
      await deps.uploads.publishMany(items)
      deps.open.value = false
      notify(`已将 ${items.length} 份音频按专辑加入曲库。`)
      await deps.onSaved()
    })
  }

  async function uploadCover(album: BatchAlbum, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    await deps.run(async () => {
      const image = await deps.uploads.cover(file)
      deps.pickPicture(album, image)
    })
  }

  return { save, publish, uploadCover }
}
