import { onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ApiError } from '@/lib/api/client'
import { uploadRepository } from './repository'
import type { BatchAlbum, BatchEntry, BatchRow } from './batchModel'
import { planNumbers, type Change, type Position } from './trackNumberPlan'

export function useUploadTrackNumbers(
  open: Ref<boolean>,
  albums: Ref<BatchAlbum[]>,
  entries: ComputedRef<BatchEntry[]>,
  busy: Ref<boolean>,
  artist: (row: BatchRow) => string,
  version: (row: BatchRow) => string,
) {
  const numbering = ref<string[]>([])
  const errors = ref<Record<string, string>>({})
  const undo = new Map<string, Change[]>()
  const requests = new Map<string, AbortController>()
  function clear() {
    for (const request of requests.values()) request.abort()
    requests.clear()
    numbering.value = []
    errors.value = {}
    undo.clear()
  }
  watch(open, (value) => {
    if (!value) clear()
  })
  watch(
    () => albums.value.map((album) => album.key),
    (keys) => {
      for (const [key, request] of requests) {
        if (keys.includes(key)) continue
        request.abort()
        requests.delete(key)
        numbering.value = numbering.value.filter((value) => value !== key)
        delete errors.value[key]
      }
      for (const key of undo.keys()) if (!keys.includes(key)) undo.delete(key)
    },
  )
  onScopeDispose(clear)

  async function numberTracks(album: BatchAlbum, restart = true) {
    if (busy.value || !albums.value.includes(album)) return
    requests.get(album.key)?.abort()
    if (!album.selection || album.selection === 'none') {
      requests.delete(album.key)
      numbering.value = numbering.value.filter((key) => key !== album.key)
      delete errors.value[album.key]
      return
    }
    const request = new AbortController()
    requests.set(album.key, request)
    if (!numbering.value.includes(album.key)) numbering.value.push(album.key)
    delete errors.value[album.key]
    const selection = album.selection
    try {
      const start = album.trackStart
      if (!Number.isInteger(start) || start < 1 || start > 9999)
        throw new Error('起始曲序请填写 1 到 9999 的整数。')
      let positions: Position[] = []
      const members = entries.value.filter(({ row }) => row.albumKey === album.key)
      const id = selection === 'new' ? album.id : selection
      const pending = albums.value
        .filter((item) => (item.selection === 'new' ? item.id : item.selection) === id)
        .flatMap((item) =>
          entries.value.filter(
            ({ row, task }) =>
              row.albumKey === item.key && task.draft.pendingPublish && task.state === 'ready',
          ),
        )
      for (let offset = 0; offset < pending.length; offset += 100) {
        const chunk = pending.slice(offset, offset + 100)
        const response = await uploadRepository.previewFiles(
          chunk.map(({ task }) => task.transfer.file!.id),
          request.signal,
        )
        if (response.files.length !== chunk.length)
          throw new Error('部分音频状态已变化，请刷新上传列表。')
        if (response.files.some((file) => file.song_id))
          throw new Error('部分音频已经入库，请先在上传队列重试确认结果，再调整曲序。')
      }
      const needsPositions =
        selection !== 'new' ||
        members.some(
          ({ task }) =>
            task.draft.albumAssignment?.album?.id === id ||
            task.draft.pendingPublish ||
            task.state === 'published',
        )
      if (needsPositions) {
        try {
          positions = (await uploadRepository.albumPositions(id, request.signal)).items
        } catch (error) {
          if (!(selection === 'new' && error instanceof ApiError && error.status === 404))
            throw error
        }
      }
      if (
        request.signal.aborted ||
        album.selection !== selection ||
        !albums.value.includes(album) ||
        !open.value
      )
        return
      for (const { task } of pending) {
        task.draft.pendingPublish = undefined
        task.error = ''
        task.errorStage = undefined
      }
      const related = albums.value.filter(
        (item) => (item.selection === 'new' ? item.id : item.selection) === id,
      )
      const changes = planNumbers(
        related.flatMap((item) => entries.value.filter(({ row }) => row.albumKey === item.key)),
        positions,
        start,
        restart,
        artist,
        version,
        new Set(
          restart ? related.filter((item) => item.key !== album.key).map((item) => item.key) : [],
        ),
      )
      if (changes.length) {
        for (const item of related) {
          const groupChanges = changes.filter(({ row }) => row.albumKey === item.key)
          if (groupChanges.length) undo.set(item.key, groupChanges)
        }
        for (const change of changes) Object.assign(change.row, change.after)
      }
    } catch (error) {
      if (!request.signal.aborted)
        errors.value[album.key] =
          error instanceof Error ? error.message : '读取专辑曲序失败，请稍后重试。'
    } finally {
      if (requests.get(album.key) === request) {
        requests.delete(album.key)
        numbering.value = numbering.value.filter((key) => key !== album.key)
      }
    }
  }
  function canUndoNumbers(album: BatchAlbum) {
    return (
      !busy.value &&
      !numbering.value.includes(album.key) &&
      !!undo
        .get(album.key)
        ?.every(
          ({ row, after }) =>
            entries.value.some(
              (entry) =>
                entry.row === row &&
                entry.task.state === 'ready' &&
                !entry.task.draft.pendingPublish,
            ) &&
            row.albumKey === album.key &&
            row.disc === after.disc &&
            row.track === after.track,
        )
    )
  }
  function undoNumbers(album: BatchAlbum) {
    if (!canUndoNumbers(album)) return
    for (const { row, before } of undo.get(album.key)!) Object.assign(row, before)
    undo.delete(album.key)
    delete errors.value[album.key]
  }
  return { numbering, numberingErrors: errors, numberTracks, canUndoNumbers, undoNumbers }
}
