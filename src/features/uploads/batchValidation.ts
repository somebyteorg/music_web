import { computed, type ComputedRef, type Ref } from 'vue'
import { uploadTrackKey } from './model'
import type { AlbumAssets, BatchAlbum, BatchEntry, BatchForm, BatchRow } from './batchModel'

interface BatchValidationDeps {
  ready: ComputedRef<BatchEntry[]>
  albums: Ref<BatchAlbum[]>
  form: Ref<BatchForm>
  numbering: Ref<string[]>
  numberingErrors: Ref<Record<string, string>>
  assetsLoading: Ref<boolean>
  assetsError: Ref<string>
  groupEntries(album: BatchAlbum): BatchEntry[]
  albumFor(row: BatchRow): BatchAlbum
  songArtist(row: BatchRow): string
  songVersion(row: BatchRow): string
  assets(album: BatchAlbum): AlbumAssets
  pictures(album: BatchAlbum): { waiting: boolean; type: string; id: string }[]
}

/** 发布前校验：曲序冲突、封面待上传、必填字段与曲序范围 */
export function createBatchValidation(deps: BatchValidationDeps) {
  function problems(album: BatchAlbum) {
    if (
      !album.selection ||
      album.selection === 'none' ||
      album.loading ||
      deps.numbering.value.includes(album.key)
    )
      return []
    const albumId = album.selection === 'new' ? album.id : album.selection
    const items = deps.albums.value
      .filter((item) => (item.selection === 'new' ? item.id : item.selection) === albumId)
      .flatMap(deps.groupEntries)
      .filter(({ task }) => task.state !== 'published')
    const seen = new Map<string, string>()
    const warnings: string[] = []
    if (album.replaceCover && selectedAlbumOf(album) && !deps.assets(album).cover_id)
      warnings.push('请选择替换用的图片，或取消替换已有专辑封面。')
    for (const { row, task } of items) {
      const slot = `${row.disc}:${row.track}`
      const identity = row.choice.startsWith('track:')
        ? row.choice
        : JSON.stringify([
            task.draft.publicationGroup,
            uploadTrackKey({
              album_id: album.selection,
              name: row.title,
              artist_name: deps.songArtist(row),
              recording_version: deps.songVersion(row),
              disc_number: row.disc,
              track_number: row.track,
              recording_song_id: row.choice.startsWith('recording:')
                ? row.choice.slice(10)
                : undefined,
            }),
          ])
      if (seen.has(slot) && seen.get(slot) !== identity && row.albumKey === album.key)
        warnings.push(`第 ${row.disc} 碟第 ${row.track} 首重复，请核对曲序或关联已有曲目。`)
      seen.set(slot, identity)
    }
    return [...new Set(warnings)]
  }

  function selectedAlbumOf(album: BatchAlbum) {
    return album.matches.find((match) => match.id === album.selection)
  }

  const valid = computed(
    () =>
      !deps.numbering.value.length &&
      !deps.assetsLoading.value &&
      !deps.assetsError.value &&
      (deps.ready.value.every(({ row }) => row.choice.startsWith('track:')) ||
        !!deps.form.value.libraryId) &&
      deps.ready.value.every(
        ({ row }) =>
          row.choice.startsWith('track:') ||
          (!deps.form.value.applyArtist && !deps.albumFor(row).applyArtist) ||
          !!deps.songArtist(row),
      ) &&
      deps.ready.value.every(
        ({ row }) =>
          !row.searching &&
          row.title.trim() &&
          Number.isInteger(row.disc) &&
          row.disc >= 1 &&
          row.disc <= 999 &&
          Number.isInteger(row.track) &&
          row.track >= 1 &&
          row.track <= 9999 &&
          deps.albumFor(row),
      ) &&
      deps.albums.value
        .filter((album) => deps.groupEntries(album).length)
        .every(
          (album) =>
            !deps.numberingErrors.value[album.key] &&
            album.selection &&
            !album.loading &&
            (album.selection !== 'new' ||
              (album.name.trim() &&
                (!album.release_year ||
                  (Number.isInteger(album.release_year) &&
                    album.release_year >= 1000 &&
                    album.release_year <= 9999)))) &&
            !problems(album).length &&
            (album.selection === 'none' ||
              !deps
                .pictures(album)
                .some(
                  (picture) =>
                    picture.waiting &&
                    (album.includeArtwork ||
                      (album.coverChoice === 'auto' &&
                        picture.type === 'cover' &&
                        !selectedAlbumOf(album)?.cover_id)),
                )),
        ),
  )

  return { problems, valid }
}
