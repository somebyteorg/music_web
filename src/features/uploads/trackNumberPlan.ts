import type { BatchEntry, BatchRow } from './batchModel'

export interface Position {
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
export interface Change {
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

export function planNumbers(
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
      : task.metadata.songId || task.transfer.file?.song_id || undefined
    const disc = Number.isInteger(row.disc) && row.disc >= 1 && row.disc <= 999 ? row.disc : 1
    const key = row.choice.startsWith('track:')
      ? row.choice
      : JSON.stringify([
          task.draft.publicationGroup || row.albumKey,
          disc,
          task.metadata.track,
          row.title.trim() || task.id,
          artist(row).trim(),
          version(row).trim(),
          row.choice,
        ])
    const duration = task.transfer.file?.duration || task.metadata.duration || 0
    const fixed =
      task.state === 'published' || !!task.draft.pendingPublish || fixedGroups.has(row.albumKey)
    const unit = units.find((candidate) => {
      if (songId && candidate.songId === songId) return true
      if (candidate.key !== key || (songId && candidate.songId && songId !== candidate.songId))
        return false
      const previous = candidate.entries[0]!.task
      const previousDuration = previous.transfer.file?.duration || previous.metadata.duration || 0
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
        task.draft.pendingPublish ||
        fixedGroups.has(row.albumKey) ||
        (row.disc === after.disc && row.track === after.track)
      )
        continue
      changes.push({ row, before: { disc: row.disc, track: row.track }, after })
    }
  }
  return changes
}
