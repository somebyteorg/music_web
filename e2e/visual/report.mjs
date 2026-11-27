/** 视觉回归的控制台输出：逐对结果、按主题小计、总汇总。 */

import { THEME_LABELS } from './targets.mjs'

export function printPair(pair) {
  if (pair.missing) {
    process.stdout.write(`${pair.name.padEnd(34)} 缺少基线，请先 pnpm test:visual:update\n`)
    return
  }
  const ratio = (pair.diffRatio * 100).toFixed(4)
  process.stdout.write(
    `${pair.name.padEnd(34)} 尺寸 ${pair.size} ${pair.sizeOk ? '一致' : '不一致'}  ` +
      `差异 ${ratio}%  最大通道差 ${pair.maxDelta}  ${pair.pass ? '通过' : '失败'}\n`,
  )
}

export function summarize(pairs, themes, limits) {
  for (const theme of themes) {
    const group = pairs.filter((pair) => pair.theme === theme)
    if (!group.length) continue
    const failed = group.filter((pair) => !pair.pass).length
    process.stdout.write(`${THEME_LABELS[theme]}：${group.length} 对，失败 ${failed}\n`)
  }
  const failed = pairs.filter((pair) => !pair.pass)
  process.stdout.write(
    `\n共 ${pairs.length} 对，通过 ${pairs.length - failed.length}，失败 ${failed.length}` +
      `（阈值：差异 ≤ ${(limits.maxDiffRatio * 100).toFixed(3)}%，通道差 ≤ ${limits.maxChannelDelta}）\n`,
  )
  if (!failed.length) return
  process.stdout.write(`失败：${failed.map((pair) => pair.name).join(', ')}\n`)
  process.stdout.write('实际截图：e2e/__shots__/actual，差异图：e2e/__shots__/diff\n')
}
