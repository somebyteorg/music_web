/**
 * 布局快照对比：几何、颜色、结构三类差异，输出可读的「元素 / 属性 / 旧值 → 新值」。
 *
 * 判定规则：
 * - 几何：x/y/width/height 任一边差 > 1px 失败（允许 1px 取整抖动）；
 * - 长度类样式（padding/margin/border-width/字号…）：同样允许 1px 取整抖动；
 * - 颜色（color / *-color）：rgb() 三元组与 alpha 必须逐字节相等，没有容差；
 * - 结构：元素数量、DOM 顺序、tag、class 签名、直接文本前缀任一不一致即失败。
 */

const GEOMETRY_KEYS = ['x', 'y', 'width', 'height']
const PIXEL_VALUE = /^-?\d+(?:\.\d+)?px$/
const DEFAULT_TOLERANCE = 1

export function isColorKey(key) {
  return key === 'color' || key.endsWith('-color')
}

export function pixelValue(value) {
  return typeof value === 'string' && PIXEL_VALUE.test(value) ? Number(value.slice(0, -2)) : null
}

function elementIdent(element, index) {
  const classes = element.classes ? `.${element.classes.split(' ').join('.')}` : ''
  return `#${index} <${element.tag}${classes}>`
}

function styleDiff(key, before, after) {
  if (isColorKey(key)) return true
  const beforePx = pixelValue(before)
  const afterPx = pixelValue(after)
  if (beforePx !== null && afterPx !== null) return Math.abs(beforePx - afterPx) > DEFAULT_TOLERANCE
  return true
}

function compareStyles(index, ident, before, after, diffs) {
  const beforeStyle = before.style || {}
  const afterStyle = after.style || {}
  const keys = [...new Set([...Object.keys(beforeStyle), ...Object.keys(afterStyle)])].sort()
  for (const key of keys) {
    const oldValue = beforeStyle[key]
    const newValue = afterStyle[key]
    if (oldValue === newValue) continue
    if (oldValue === undefined) {
      diffs.push({ index, ident, kind: 'style', prop: key, before: '（未设置）', after: newValue })
      continue
    }
    if (newValue === undefined) {
      diffs.push({ index, ident, kind: 'style', prop: key, before: oldValue, after: '（未设置）' })
      continue
    }
    if (!styleDiff(key, oldValue, newValue)) continue
    diffs.push({ index, ident, kind: 'style', prop: key, before: oldValue, after: newValue })
  }
}

function compareElement(index, before, after, diffs) {
  const ident = elementIdent(after, index)
  if (before.tag !== after.tag) {
    diffs.push({
      index,
      ident,
      kind: 'structure',
      prop: 'tagName',
      before: before.tag,
      after: after.tag,
    })
    return
  }
  const beforeClasses = before.classes || ''
  const afterClasses = after.classes || ''
  if (beforeClasses !== afterClasses) {
    diffs.push({
      index,
      ident,
      kind: 'structure',
      prop: 'class',
      before: beforeClasses || '（无）',
      after: afterClasses || '（无）',
    })
  }
  const beforeText = before.text || ''
  const afterText = after.text || ''
  if (beforeText !== afterText) {
    diffs.push({
      index,
      ident,
      kind: 'structure',
      prop: 'text',
      before: beforeText || '（空）',
      after: afterText || '（空）',
    })
  }
  for (const key of GEOMETRY_KEYS) {
    const delta = after[key] - before[key]
    if (Math.abs(delta) <= DEFAULT_TOLERANCE) continue
    diffs.push({
      index,
      ident,
      kind: 'geometry',
      prop: key,
      before: before[key],
      after: after[key],
      delta,
    })
  }
  compareStyles(index, ident, before, after, diffs)
}

export function compareSnapshots(expected, actual) {
  const expectedElements = expected.elements || []
  const actualElements = actual.elements || []
  const diffs = []
  const total = Math.max(expectedElements.length, actualElements.length)
  for (let index = 0; index < total; index += 1) {
    const before = expectedElements[index]
    const after = actualElements[index]
    if (!before) {
      diffs.push({
        index,
        ident: elementIdent(after, index),
        kind: 'structure',
        prop: '元素',
        before: '（不存在）',
        after: '新增',
      })
      continue
    }
    if (!after) {
      diffs.push({
        index,
        ident: elementIdent(before, index),
        kind: 'structure',
        prop: '元素',
        before: '存在',
        after: '缺失',
      })
      continue
    }
    compareElement(index, before, after, diffs)
  }
  return {
    ok: diffs.length === 0,
    diffs,
    counts: { expected: expectedElements.length, actual: actualElements.length },
  }
}

/** 只比几何和颜色：字体替换自检用（结构必然一致，不必重复报 tag/class）。 */
export function compareLayoutOnly(expected, actual) {
  const result = compareSnapshots(expected, actual)
  const geometry = result.diffs.filter((diff) => diff.kind === 'geometry')
  const colors = result.diffs.filter((diff) => diff.kind === 'style' && isColorKey(diff.prop))
  const styles = result.diffs.filter((diff) => diff.kind === 'style' && !isColorKey(diff.prop))
  const maxDelta = geometry.reduce((max, diff) => Math.max(max, Math.abs(diff.delta || 0)), 0)
  return {
    ok: result.ok,
    diffs: result.diffs,
    counts: result.counts,
    geometry,
    colors,
    styles,
    maxDelta,
    shiftedElements: new Set(geometry.map((diff) => diff.index)).size,
  }
}
