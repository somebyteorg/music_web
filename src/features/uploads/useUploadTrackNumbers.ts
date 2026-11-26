import { onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ApiError } from '@/lib/api/client'
import { uploadRepository } from './repository'
import type { BatchAlbum, BatchEntry, BatchRow } from './batchModel'

interface Position {
  song_id: string
  disc_number: number
  track_number: number
}
interface Unit {
  key: string
  entries: BatchEntry[]
  songId?: string
  fixed: boolean
  disc: number
  track: number
}
interface Change {
  row: BatchRow
  before: { disc: number; track: number }
  after: { disc: number; track: number }
}

function validPosition(disc: number, track: number) {
  return (
    Number.isInteger(disc) &&
    disc >= 1 &&
    disc <= 999 &&
    Number.isInteger(track) &&
    track >= 1 &&
    track <= 9999
  )
}

function planNumbers(
  entries: BatchEntry[],
  positions: Position[],
  start: number,
  restart: boolean,
  artist: (row: BatchRow) => string,
  version: (row: BatchRow) => string,
  fixedGroups: Set<string>,
) {
  const units: Unit[] = []
  for (const entry of entries) {
    const { row, task } = entry
    const songId = row.choice.startsWith('track:')
      ? row.choice.slice(6)
      : task.songId || task.file?.song_id || undefined
    const disc = Number.isInteger(row.disc) && row.disc >= 1 && row.disc <= 999 ? row.disc : 1
    const key = row.choice.startsWith('track:')
      ? row.choice
      : JSON.stringify([
          task.publicationGroup || row.albumKey,
          disc,
          task.track,
          row.title.trim() || task.id,
          artist(row).trim(),
          version(row).trim(),
          row.choice,
        ])
    const duration = task.file?.duration || task.duration || 0
    const fixed =
      task.state === 'published' || !!task.pendingPublish || fixedGroups.has(row.albumKey)
    const unit = units.find((candidate) => {
      if (songId && candidate.songId === songId) return true
      if (candidate.key !== key || (songId && candidate.songId && songId !== candidate.songId))
        return false
      const previous = candidate.entries[0]!.task
      const previousDuration = previous.file?.duration || previous.duration || 0
      return (
        Math.abs(previousDuration - duration) <=
        Math.max(5, Math.min(previousDuration, duration) * 0.02)
      )
    })
    if (unit) {
      unit.entries.push(entry)
      unit.songId ||= songId
      if (fixed && !unit.fixed) {
        unit.disc = disc
        unit.track = row.track
      }
      unit.fixed ||= fixed
    } else {
      units.push({
        key,
        entries: [entry],
        songId,
        fixed,
        disc,
        track: row.track,
      })
    }
  }
  const occupied = new Map<number, Set<number>>()
  const reserve = (disc: number, track: number) => {
    if (!occupied.has(disc)) occupied.set(disc, new Set())
    occupied.get(disc)!.add(track)
  }
  const placements = new Map(positions.map((position) => [position.song_id, position]))
  for (const position of positions) reserve(position.disc_number, position.track_number)
  const assigned = new Map<Unit, { disc: number; track: number }>()
  for (const unit of units) {
    const existing = unit.songId ? placements.get(unit.songId) : undefined
    if (existing) {
      assigned.set(unit, { disc: existing.disc_number, track: existing.track_number })
    } else if (unit.fixed) {
      assigned.set(unit, { disc: unit.disc, track: unit.track })
      reserve(unit.disc, unit.track)
    }
  }
  if (!restart) {
    for (const unit of units) {
      if (
        !assigned.has(unit) &&
        validPosition(unit.disc, unit.track) &&
        !occupied.get(unit.disc)?.has(unit.track)
      ) {
        assigned.set(unit, { disc: unit.disc, track: unit.track })
        reserve(unit.disc, unit.track)
      }
    }
  }
  const next = new Map<number, number>()
  for (const unit of units) {
    if (assigned.has(unit)) continue
    let track = restart
      ? next.get(unit.disc) || start
      : Math.max(start, validPosition(unit.disc, unit.track) ? unit.track : start)
    while (occupied.get(unit.disc)?.has(track)) track++
    if (track > 9999) throw new Error(`第 ${unit.disc} 碟的曲序超过 9999，请拆分碟片后重试。`)
    assigned.set(unit, { disc: unit.disc, track })
    reserve(unit.disc, track)
    next.set(unit.disc, track + 1)
  }
  const changes: Change[] = []
  for (const unit of units) {
    const after = assigned.get(unit)!
    for (const { row, task } of unit.entries) {
      if (
        task.state === 'published' ||
        task.pendingPublish ||
        fixedGroups.has(row.albumKey) ||
        (row.disc === after.disc && row.track === after.track)
      )
        continue
      changes.push({ row, before: { disc: row.disc, track: row.track }, after })
    }
  }
  return changes
}

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
              row.albumKey === item.key && task.pendingPublish && task.state === 'ready',
          ),
        )
      for (let offset = 0; offset < pending.length; offset += 100) {
        const chunk = pending.slice(offset, offset + 100)
        const response = await uploadRepository.previewFiles(
          chunk.map(({ task }) => task.file!.id),
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
            task.albumAssignment?.album?.id === id ||
            task.pendingPublish ||
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
        task.pendingPublish = undefined
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
                entry.row === row && entry.task.state === 'ready' && !entry.task.pendingPublish,
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
