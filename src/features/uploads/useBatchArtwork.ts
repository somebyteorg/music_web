import { type ComputedRef, onBeforeUnmount, ref, type Ref } from 'vue'
import type { ArtworkType } from '@/types/catalog'
import type { AudioFile } from '@/types/uploads'
import { filesApi } from '@/lib/api/files'
import { useUploadsStore } from '@/stores/uploads'
import { artworkType } from '@/utils/albumArtwork'
import {
  albumFolder,
  type BatchAlbum,
  type BatchEntry,
  selectedBatchAlbum,
  uploadFolder,
} from './batchModel'

export function useBatchArtwork(entries: ComputedRef<BatchEntry[]>, albums: Ref<BatchAlbum[]>) {
  const uploads = useUploadsStore()
  function groupEntries(album: BatchAlbum) {
    return entries.value.filter(({ row }) => row.albumKey === album.key)
  }
  const remotePictures = ref<AudioFile[]>([])
  const assetsLoading = ref(false)
  const assetsError = ref('')
  let sourceController: AbortController | undefined
  onBeforeUnmount(() => sourceController?.abort())
  function pictures(album: BatchAlbum) {
    const sources = groupEntries(album).map(({ task }) => task)
    function related(path: string, batchId?: string) {
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
      return sources.some((source) => {
        if (source.batchId !== batchId) return false
        const dir = uploadFolder(source)
        const dirs = [dir, albumFolder(source)]
        return dirs.some(
          (dir) =>
            parent === dir || (dir && parent.toLowerCase() === `${dir}/artwork`.toLowerCase()),
        )
      })
    }
    const covers = uploads.tasks.filter(
      (task) => task.kind === 'cover' && related(task.relativePath, task.batchId),
    )
    const result: {
      id: string
      name: string
      type: ArtworkType
      waiting: boolean
      file?: AudioFile
    }[] = []
    for (const task of covers) {
      const file = task.file || uploads.duplicateFile(task)
      if (task.state === 'skipped') continue
      result.push({
        id: file?.id || task.id,
        name: task.name,
        type: artworkType(task.name),
        waiting: !file,
        file,
      })
    }
    for (const file of remotePictures.value) {
      if (file.upload_context?.some((context) => related(context.relative_path, context.batch_id)))
        result.push({
          id: file.id,
          name: file.file_name,
          type: artworkType(file.file_name),
          waiting: false,
          file,
        })
    }
    for (const { task } of groupEntries(album)) {
      const id = task.file?.preview?.cover_id
      if (id && !result.some((picture) => picture.id === id))
        result.push({ id, name: '音频内嵌封面', type: 'cover', waiting: false })
    }
    for (const picture of album.artwork) {
      if (!result.some((item) => item.id === picture.file_id))
        result.push({
          id: picture.file_id,
          name:
            remotePictures.value.find((file) => file.id === picture.file_id)?.file_name ||
            '已选图片',
          type: picture.type,
          waiting: false,
          file: remotePictures.value.find((file) => file.id === picture.file_id),
        })
    }
    return result.filter(
      (picture, index, all) =>
        !album.excludedPictureIds.includes(picture.id) &&
        all.findIndex((item) => item.id === picture.id) === index,
    )
  }
  function assets(album: BatchAlbum) {
    const available = pictures(album).filter((picture) => !picture.waiting)
    const cover =
      album.coverChoice === 'auto'
        ? available.find((picture) => picture.type === 'cover')?.id || null
        : album.coverChoice || null
    return {
      cover_id: cover,
      artwork: available
        .filter((picture) => album.includeArtwork || picture.id === cover)
        .map((picture) => ({
          file_id: picture.id,
          type: picture.id === cover ? ('cover' as const) : picture.type,
        })),
    }
  }
  function coverOptions(album: BatchAlbum) {
    return [
      { value: 'auto', label: '采用目录正面图或内嵌封面' },
      { value: '', label: '本次不指定封面' },
      ...pictures(album)
        .filter((p) => !p.waiting)
        .map((picture) => ({ value: picture.id, label: picture.name })),
    ]
  }
  function coverId(album: BatchAlbum) {
    const current = selectedBatchAlbum(album)
    return current && !album.replaceCover && (current.cover_id || current.image_url)
      ? current.cover_id
      : assets(album).cover_id
  }
  function pictureId(album: BatchAlbum) {
    return assets(album).cover_id
  }
  function pickPicture(album: BatchAlbum, file: AudioFile) {
    if (!remotePictures.value.some((picture) => picture.id === file.id))
      remotePictures.value.push(file)
    album.excludedPictureIds = album.excludedPictureIds.filter((id) => id !== file.id)
    if (!album.artwork.some((picture) => picture.file_id === file.id))
      album.artwork.push({ file_id: file.id, type: 'cover' })
    album.coverChoice = file.id
  }
  function removePicture(album: BatchAlbum, id: string) {
    const wasCover = assets(album).cover_id === id
    if (!album.excludedPictureIds.includes(id)) album.excludedPictureIds.push(id)
    album.artwork = album.artwork.filter((picture) => picture.file_id !== id)
    if (album.coverChoice === id || wasCover) album.coverChoice = ''
  }
  function forgetPicture(id: string) {
    remotePictures.value = remotePictures.value.filter((file) => file.id !== id)
    for (const album of albums.value) removePicture(album, id)
  }
  async function hydratePictures() {
    sourceController?.abort()
    const request = new AbortController()
    sourceController = request
    remotePictures.value = []
    assetsLoading.value = true
    assetsError.value = ''
    try {
      for (const batchId of new Set(
        entries.value.map(({ task }) => task.batchId).filter((id): id is string => !!id),
      )) {
        let page = 1
        while (true) {
          const response = await filesApi.page(
            { kind: 'cover', active: 1, batch_id: batchId, page, page_size: 60 },
            request.signal,
          )
          remotePictures.value.push(...response.items)
          if (page * response.page_size >= response.total) break
          page++
        }
      }
    } catch (e) {
      if (!request.signal.aborted)
        assetsError.value = e instanceof Error ? e.message : '加载目录图片失败，请重试。'
    } finally {
      if (!request.signal.aborted) assetsLoading.value = false
    }
  }

  return {
    assets,
    coverId,
    pictureId,
    assetsLoading,
    assetsError,
    hydratePictures,
    pickPicture,
    removePicture,
    forgetPicture,
    coverOptions,
    pictures,
  }
}
