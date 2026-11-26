import { computed, ref, type UnwrapRef } from 'vue'
import { useLibrariesStore } from '@/stores/libraries'
import { useUploadsStore } from '@/stores/uploads'
import { useAction } from '@/composables/useFeedback'
import {
  type BatchAlbum,
  type BatchEntry,
  type BatchForm,
  type BatchGrouping,
  type BatchRow,
  selectedBatchAlbum as selectedAlbum,
} from './batchModel'
import { createBatchDrafts } from './batchDrafts'
import { createBatchGroups } from './batchGroups'
import { createBatchMatching } from './batchMatching'
import { createBatchPublishing } from './batchPublishing'
import { createBatchRowFields } from './batchRows'
import { createBatchValidation } from './batchValidation'
import { useBatchArtwork } from './useBatchArtwork'
import { useUploadTrackNumbers } from './useUploadTrackNumbers'

/**
 * 批量整理音频的组合入口。
 *
 * 具体职责拆在 batchRows（歌手/版本）、batchMatching（匹配）、batchGroups（分组）、
 * batchValidation（校验）、batchPublishing（草稿与发布）与 useUploadTrackNumbers（曲序）。
 */
export function useUploadBatch(onSaved: () => Promise<void>) {
  const libraries = useLibrariesStore()
  const uploads = useUploadsStore()
  const { busy, run } = useAction()
  const open = ref(false)
  const rows = ref<BatchRow[]>([])
  const albums = ref<BatchAlbum[]>([])
  const grouping = ref<BatchGrouping>('folder')
  const form = ref<BatchForm>({
    artist: '',
    version: '',
    applyArtist: false,
    applyVersion: false,
    libraryId: '',
  })
  const entries = computed<BatchEntry[]>(() =>
    rows.value.flatMap((row) => {
      const task = uploads.tasks.find((task) => task.id === row.taskId)
      return task ? [{ row, task }] : []
    }),
  )
  const ready = computed(() =>
    entries.value.filter(({ task }) => task.state === 'ready' && task.file),
  )
  const done = computed(() => entries.value.filter(({ task }) => task.state === 'published').length)
  const groupOptions = computed(() =>
    albums.value.map((album) => ({ value: album.key, label: groupTitle(album) })),
  )
  function groupTitle(album: BatchAlbum) {
    return (
      (grouping.value === 'folder' ? album.groupLabel : '') ||
      selectedAlbum(album)?.name ||
      album.name ||
      album.groupLabel ||
      '单曲分组'
    )
  }
  function albumFor(row: BatchRow) {
    return albums.value.find((album) => album.key === row.albumKey)!
  }
  function groupEntries(album: BatchAlbum) {
    return entries.value.filter(({ row }) => row.albumKey === album.key)
  }

  const { songArtist, songVersion } = createBatchRowFields({ uploads, form, albumFor })
  const { numbering, numberingErrors, numberTracks, canUndoNumbers, undoNumbers } =
    useUploadTrackNumbers(open, albums, entries, busy, songArtist, songVersion)
  const {
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
  } = useBatchArtwork(entries, albums)
  const matching = createBatchMatching({
    albums,
    entries,
    form,
    groupEntries,
    albumFor,
    songArtist,
    songVersion,
    assets,
    numberTracks,
  })
  const groups = createBatchGroups({
    uploads,
    libraries,
    busy,
    open,
    rows,
    albums,
    grouping,
    form,
    entries,
    done,
    groupEntries,
    albumFor,
    songArtist,
    songVersion,
    choose: matching.choose,
    numberTracks,
    searchAlbums: matching.searchAlbums,
    hydratePreviews: matching.hydratePreviews,
    hydratePictures,
  })
  const validation = createBatchValidation({
    ready,
    albums,
    form,
    numbering,
    numberingErrors,
    assetsLoading,
    assetsError,
    groupEntries,
    albumFor,
    songArtist,
    songVersion,
    assets,
    pictures,
  })
  const drafts = createBatchDrafts({
    ready,
    form,
    albumFor,
    songArtist,
    songVersion,
    assets,
    albumDraft: matching.albumDraft,
  })
  const publishing = createBatchPublishing({
    form,
    open,
    valid: validation.valid,
    run,
    uploads,
    onSaved,
    drafts: drafts.drafts,
    publishItems: drafts.publishItems,
    persistDrafts: drafts.persistDrafts,
    pickPicture,
  })

  return {
    open,
    libraries,
    busy,
    rows,
    albums,
    entries,
    ready,
    done,
    valid: validation.valid,
    form,
    show: groups.show,
    save: publishing.save,
    publish: publishing.publish,
    options: matching.rowOptions,
    addAlbum: groups.addAlbum,
    grouping,
    regroup: groups.regroup,
    groupTitle,
    songArtist,
    songVersion,
    removeEmptyGroup: groups.removeEmptyGroup,
    moveGroup: groups.moveGroup,
    moveRow: groups.moveRow,
    groupOptions,
    groupEntries,
    numbering,
    numberingErrors,
    numberTracks,
    canUndoNumbers,
    undoNumbers,
    selectedAlbum,
    albumOptions: matching.albumOptions,
    searchAlbums: matching.searchAlbums,
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
    problems: validation.problems,
    changeAlbum: matching.changeAlbum,
    choose: matching.choose,
    searchTracks: matching.searchTracks,
    uploadCover: publishing.uploadCover,
  }
}

export type UploadBatch = UnwrapRef<ReturnType<typeof useUploadBatch>>
