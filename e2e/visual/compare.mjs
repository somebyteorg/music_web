/** 基线对比：pixelmatch 统计差异像素，另算一条最大单通道差，避免「整页轻微色偏」被占比掩盖。 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

function maxChannelDelta(a, b) {
  let max = 0
  for (let i = 0; i < a.length; i += 4) {
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(a[i + channel] - b[i + channel])
      if (delta > max) max = delta
    }
  }
  return max
}

function formatSize(png) {
  return `${png.width}x${png.height}`
}

export async function comparePair(name, baselinePath, actualPath, limits, diffDir) {
  if (!existsSync(baselinePath)) return { name, missing: true, pass: false }
  const baseline = PNG.sync.read(await readFile(baselinePath))
  const actual = PNG.sync.read(await readFile(actualPath))
  const sizeOk = baseline.width === actual.width && baseline.height === actual.height
  if (!sizeOk) {
    return { name, sizeOk, pass: false, diffRatio: 1, maxDelta: 255, size: formatSize(actual) }
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height })
  const changed = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    baseline.width,
    baseline.height,
    {
      threshold: 0.1,
    },
  )
  const diffRatio =
    baseline.width * baseline.height ? changed / (baseline.width * baseline.height) : 0
  const delta = maxChannelDelta(baseline.data, actual.data)
  if (changed > 0) {
    await mkdir(diffDir, { recursive: true })
    await writeFile(path.join(diffDir, `${name}.png`), PNG.sync.write(diff))
  }
  const pass = diffRatio <= limits.maxDiffRatio && delta <= limits.maxChannelDelta
  return { name, sizeOk, pass, diffRatio, maxDelta: delta, size: formatSize(actual) }
}
