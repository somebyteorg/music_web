import type { Ref } from 'vue'
import type { UploadTask } from './model'
import type { BatchAlbum, BatchForm, BatchRow } from './batchModel'

export interface BatchRowFieldsDeps {
  uploads: { tasks: UploadTask[] }
  form: Ref<BatchForm>
  albumFor(row: BatchRow): BatchAlbum
}

/** 歌曲演唱者 / 录音版本：统一填写、分组填写、关联已有歌曲三种来源的优先级 */
export function createBatchRowFields(deps: BatchRowFieldsDeps) {
  function songArtist(row: BatchRow) {
    const task = deps.uploads.tasks.find((task) => task.id === row.taskId)
    if (task?.state === 'published') return task.metadata.artist
    if (row.choice.startsWith('track:')) return row.artist
    if (deps.form.value.applyArtist) return deps.form.value.artist.trim()
    const album = deps.albumFor(row)
    return album.applyArtist ? album.performer.trim() : row.artist
  }
  function songVersion(row: BatchRow) {
    const task = deps.uploads.tasks.find((task) => task.id === row.taskId)
    if (task?.state === 'published') return task.metadata.version
    return !row.choice.startsWith('track:') && deps.form.value.applyVersion
      ? deps.form.value.version.trim()
      : row.version
  }
  return { songArtist, songVersion }
}
