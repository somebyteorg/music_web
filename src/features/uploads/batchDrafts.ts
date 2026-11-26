import type { ComputedRef, Ref } from 'vue'
import type { AlbumDraft } from '@/types/catalog'
import type { PublishData } from '@/types/uploads'
import type { UploadTask } from './model'
import type { AlbumAssets, BatchAlbum, BatchEntry, BatchForm } from './batchModel'
import { uploadRepository } from './repository'

export interface PublishItem {
  task: UploadTask
  data: PublishData
}

interface BatchDraftsDeps {
  ready: ComputedRef<BatchEntry[]>
  form: Ref<BatchForm>
  albumFor(row: BatchEntry['row']): BatchAlbum
  songArtist(row: BatchEntry['row']): string
  songVersion(row: BatchEntry['row']): string
  assets(album: BatchAlbum): AlbumAssets
  albumDraft(album: BatchAlbum): AlbumDraft
}

/** 草稿与发布数据：把界面上的整理结果落成可提交的 PublishData，并持久化草稿 */
export function createBatchDrafts(deps: BatchDraftsDeps) {
  function assignment(
    album: BatchAlbum,
  ): Pick<PublishData, 'album' | 'album_id' | 'album_supplement'> {
    if (album.selection === 'none') return { album_id: null }
    if (album.selection === 'new') return { album: deps.albumDraft(album) }
    return {
      album_id: album.selection,
      album_supplement: {
        ...deps.albumDraft(album),
        replace_cover: album.replaceCover && !!deps.assets(album).cover_id,
        cover_version: album.matches.find((match) => match.id === album.selection)?.version,
      },
    }
  }

  function drafts() {
    for (const { row, task } of deps.ready.value) {
      const { metadata, draft } = task
      metadata.title = row.title.trim()
      metadata.artist = deps.songArtist(row).trim()
      metadata.track = row.track
      metadata.disc = row.disc
      metadata.version = deps.songVersion(row).trim()
      const album = deps.albumFor(row)
      const selected = album.matches.find((match) => match.id === album.selection)
      metadata.album = album.selection === 'none' ? '' : selected?.name || album.name.trim()
      metadata.albumArtist =
        album.selection === 'none'
          ? ''
          : selected?.artists?.map((a) => a.name).join(' / ') || album.artist_name.trim()
      metadata.libraryId = deps.form.value.libraryId
      draft.albumAssignment = assignment(album)
      draft.organizeDraft = {
        choice: row.choice,
        coverChoice:
          album.coverChoice === 'auto' ? deps.assets(album).cover_id || '' : album.coverChoice,
        includeArtwork: album.includeArtwork,
        excludedPictureIds: album.excludedPictureIds,
        replaceCover: album.replaceCover,
        match: row.matches.find((match) => row.choice.endsWith(match.id)),
      }
    }
  }

  async function persistDrafts(items: PublishItem[]) {
    for (let offset = 0; offset < items.length; offset += 100) {
      await uploadRepository.saveDrafts(
        items.slice(offset, offset + 100).map(({ task, data }) => {
          const organize = task.draft.organizeDraft!
          return {
            file_id: task.transfer.file!.id,
            data,
            organize: {
              coverChoice: organize.coverChoice,
              includeArtwork: organize.includeArtwork,
              excludedPictureIds: organize.excludedPictureIds || [],
              replaceCover: organize.replaceCover || false,
            },
          }
        }),
      )
    }
  }

  function publishItems(): PublishItem[] {
    return deps.ready.value.map(({ row, task }) => ({
      task,
      data: {
        ...assignment(deps.albumFor(row)),
        publication_group: task.draft.publicationGroup,
        library_id: deps.form.value.libraryId,
        disc_number: row.disc,
        track_number: row.track,
        ...(row.choice.startsWith('track:')
          ? { song_id: row.choice.slice(6) }
          : {
              name: task.metadata.title,
              artist_name: task.metadata.artist,
              recording_version: task.metadata.version,
              track_number: task.metadata.track,
              disc_number: task.metadata.disc,
              ...(row.choice.startsWith('recording:')
                ? { recording_song_id: row.choice.slice(10) }
                : {}),
            }),
      } satisfies PublishData,
    }))
  }

  return { assignment, drafts, persistDrafts, publishItems }
}
