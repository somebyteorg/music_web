/**
 * 布局快照的输出格式：每个快照一行结论，失败时逐条列出「元素 / 属性 / 旧值 → 新值」。
 */

const KIND_LABEL = { structure: '结构', geometry: '几何', style: '样式' }
const NAME_WIDTH = 24
const DIFF_LIMIT = 40

function pad(name) {
  return name.padEnd(NAME_WIDTH)
}

function describe(diff) {
  const label = KIND_LABEL[diff.kind] || diff.kind
  const before = String(diff.before)
  const after = String(diff.after)
  const delta =
    typeof diff.delta === 'number' ? `（${diff.delta > 0 ? '+' : ''}${diff.delta}px）` : ''
  return `    ${diff.ident}  ${label} ${diff.prop}  ${before} → ${after}${delta}`
}

export function formatSnapshotLine(name, result) {
  if (result.missing) return `${pad(name)}缺少基线，请先 pnpm test:layout:update`
  const counts = `${result.counts.actual}/${result.counts.expected}`
  const status = result.ok ? '通过' : '失败'
  return `${pad(name)}元素 ${counts}  差异 ${String(result.diffs.length).padStart(3)}  ${status}`
}

export function formatDiffLines(diffs, limit = DIFF_LIMIT) {
  const lines = diffs.slice(0, limit).map(describe)
  if (diffs.length > limit) lines.push(`    … 还有 ${diffs.length - limit} 处差异未列出`)
  return lines
}

export function formatFontProbeLine(name, probe) {
  return (
    `${pad(name)}元素 ${probe.counts.actual}  几何差异 ${probe.shiftedElements}  ` +
    `颜色差异 ${probe.colors.length}  其他样式差异 ${probe.styles.length}  最大位移 ${probe.maxDelta}px`
  )
}

export function formatSummary(results) {
  const failed = results.filter((result) => !result.ok)
  const missing = results.filter((result) => result.missing)
  if (missing.length) {
    return `共 ${results.length} 个快照，其中 ${missing.length} 个缺少基线：请先 pnpm test:layout:update`
  }
  const parts = [
    `共 ${results.length} 个快照，通过 ${results.length - failed.length}，失败 ${failed.length}`,
  ]
  if (failed.length) {
    parts.push(`失败：${failed.map((result) => result.name).join(', ')}`)
  }
  return parts.join('\n')
}

export function formatProbeSummary(probes) {
  const geometry = probes.reduce((sum, probe) => sum + probe.shiftedElements, 0)
  const colors = probes.reduce((sum, probe) => sum + probe.colors.length, 0)
  const styles = probes.reduce((sum, probe) => sum + probe.styles.length, 0)
  const maxDelta = probes.reduce((max, probe) => Math.max(max, probe.maxDelta), 0)
  const elements = probes.reduce((sum, probe) => sum + probe.counts.actual, 0)
  return (
    `字体替换自检合计：${probes.length} 个快照 / ${elements} 个元素，几何差异 ${geometry} 个元素，` +
    `颜色差异 ${colors} 条，其他样式差异 ${styles} 条，最大位移 ${maxDelta}px`
  )
}
