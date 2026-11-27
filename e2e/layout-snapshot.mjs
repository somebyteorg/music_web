/**
 * 布局与计算样式快照：不依赖字体的跨机器视觉门禁。
 *
 *   pnpm test:layout:update                     # 生成/更新基线 e2e/__layout__/<route>-<width>.json
 *   pnpm test:layout                            # 与基线对比，有差异退出码 1
 *   node e2e/layout-snapshot.mjs --font-probe    # 字体替换自检：font-family 换成 serif 后再采一次
 *
 * 与 e2e/visual.mjs 的分工：像素基线绑定渲染机器（同一提交在别的机器上会有 1~2% 字体抗锯齿差异），
 * 本脚本记录的是布局盒子（整像素）与颜色（rgb()），换机器、换字体都应稳定，所以能当 CI 门禁。
 */

import { existsSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { collectSnapshot } from './layout/collect.mjs'
import { compareLayoutOnly, compareSnapshots } from './layout/compare.mjs'
import {
  CONTEXT_OPTIONS,
  ROOT,
  ROUTES,
  VIEWPORT_HEIGHT,
  WIDTHS,
  arg,
  delay,
  launchArgs,
  numberArg,
  openRoute,
  startPreview,
  stopChild,
  waitForHttp,
} from './layout/harness.mjs'
import {
  formatDiffLines,
  formatFontProbeLine,
  formatProbeSummary,
  formatSnapshotLine,
  formatSummary,
} from './layout/report.mjs'
import {
  formatBytes,
  readSnapshotFile,
  snapshotFileName,
  writeSnapshotFile,
} from './layout/snapshot.mjs'
import { startStubApi } from './stub-api.mjs'

const DIST_ENTRY = path.join(ROOT, 'dist', 'index.html')
const LAYOUT_DIR = path.join(ROOT, 'e2e', '__layout__')
/**
 * 字体替换自检的判据：
 * - 颜色必须零差异 —— 颜色与字体毫无关系，出现差异说明采集/归一化有问题；
 * - 几何允许极少数「宽度由文字内容撑开」的盒子微移（flex-basis:auto、inline-block、
 *   auto margin 的已用值都会跟着文字宽度走）。本项目的 flex 行里这类盒子不少，
 *   实测占比 <1%、位移 ≤8px；真·布局盒子（定宽/栅格）必须一动不动。
 */
const FONT_PROBE_MAX_SHIFT_RATIO = 0.02
const FONT_PROBE_MAX_DELTA = 8
const FONT_PROBE_DIFF_LINES = 6

function printHelp() {
  process.stdout.write(
    [
      '用法：node e2e/layout-snapshot.mjs [选项]',
      '',
      '  --update                    生成/更新布局基线',
      '  --font-probe                字体替换自检（不比对基线，退出码反映自检结论）',
      '  --ignore-raster             去掉抗锯齿相关启动参数再比对（应仍 0 差异）',
      '  --api-port=8150             mock 后端端口',
      '  --preview-port=4250         vite preview 端口',
      '  --routes=/albums,/settings  只跑指定路由',
      '  --widths=390,768,1280       只跑指定宽度',
      '',
    ].join('\n'),
  )
}

function selectRoutes(filter) {
  if (!filter) return ROUTES
  const wanted = new Set(
    filter
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  )
  const known = ROUTES.filter((route) => wanted.has(route.path))
  const unknown = [...wanted].filter((value) => !ROUTES.some((route) => route.path === value))
  if (unknown.length) throw new Error(`未知路由：${unknown.join(', ')}`)
  return known
}

function selectWidths(filter) {
  if (!filter) return WIDTHS
  const widths = filter
    .split(',')
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
  if (!widths.length) throw new Error(`宽度参数无效：${filter}`)
  return widths
}

async function capture(page, origin, route, width) {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT })
  await openRoute(page, origin, route)
  return collectSnapshot(page, { route: route.path, width, viewportHeight: VIEWPORT_HEIGHT })
}

async function runUpdate(page, origin, routes, widths) {
  let totalBytes = 0
  let totalElements = 0
  let files = 0
  for (const width of widths) {
    for (const route of routes) {
      const snapshot = await capture(page, origin, route, width)
      const name = snapshotFileName(route.path, width)
      const bytes = await writeSnapshotFile(path.join(LAYOUT_DIR, name), snapshot)
      totalBytes += bytes
      totalElements += snapshot.elements.length
      files += 1
      process.stdout.write(
        `写入 ${name}  元素 ${snapshot.elements.length}  ${formatBytes(bytes)}\n`,
      )
    }
  }
  process.stdout.write(
    `\n已写入 ${files} 个基线到 e2e/__layout__（${totalElements} 个元素，合计 ${formatBytes(totalBytes)}）\n`,
  )
  return 0
}

async function runCompare(page, origin, routes, widths) {
  const results = []
  for (const width of widths) {
    for (const route of routes) {
      const name = snapshotFileName(route.path, width)
      const file = path.join(LAYOUT_DIR, name)
      const label = name.replace(/\.json$/, '')
      if (!existsSync(file)) {
        const missing = {
          name: label,
          ok: false,
          missing: true,
          diffs: [],
          counts: { expected: 0, actual: 0 },
        }
        results.push(missing)
        process.stdout.write(`${formatSnapshotLine(label, missing)}\n`)
        continue
      }
      const snapshot = await capture(page, origin, route, width)
      const expected = await readSnapshotFile(file)
      const result = { name: label, ...compareSnapshots(expected, snapshot) }
      results.push(result)
      process.stdout.write(`${formatSnapshotLine(label, result)}\n`)
    }
  }
  const failed = results.filter((result) => !result.ok)
  for (const result of failed) {
    if (result.missing) continue
    process.stdout.write(`\n${result.name}：\n`)
    for (const line of formatDiffLines(result.diffs)) process.stdout.write(`${line}\n`)
  }
  process.stdout.write(`\n${formatSummary(results)}\n`)
  if (failed.length) {
    process.stdout.write(
      '基线位置：e2e/__layout__；确认改动符合预期后运行 pnpm test:layout:update\n',
    )
    return 1
  }
  return 0
}

async function runFontProbe(page, origin, routes, widths) {
  const probes = []
  process.stdout.write('字体替换自检：把 font-family 换成 serif，再采一次布局快照\n')
  for (const width of widths) {
    for (const route of routes) {
      const name = snapshotFileName(route.path, width).replace(/\.json$/, '')
      const baseline = await capture(page, origin, route, width)
      await page.addStyleTag({ content: '*, *::before, *::after { font-family: serif }' })
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
      await delay(80)
      const swapped = await collectSnapshot(page, {
        route: route.path,
        width,
        viewportHeight: VIEWPORT_HEIGHT,
      })
      const probe = { name, ...compareLayoutOnly(baseline, swapped) }
      probes.push(probe)
      process.stdout.write(`${formatFontProbeLine(name, probe)}\n`)
      if (probe.diffs.length) {
        for (const line of formatDiffLines(probe.diffs, FONT_PROBE_DIFF_LINES)) {
          process.stdout.write(`${line}\n`)
        }
      }
    }
  }
  const total = probes.reduce((sum, probe) => sum + probe.counts.actual, 0)
  const shiftRatio = total
    ? probes.reduce((sum, probe) => sum + probe.shiftedElements, 0) / total
    : 0
  const colorDiffs = probes.reduce((sum, probe) => sum + probe.colors.length, 0)
  const maxDelta = probes.reduce((max, probe) => Math.max(max, probe.maxDelta), 0)
  process.stdout.write(`\n${formatProbeSummary(probes)}\n`)
  const pass =
    colorDiffs === 0 && shiftRatio <= FONT_PROBE_MAX_SHIFT_RATIO && maxDelta <= FONT_PROBE_MAX_DELTA
  process.stdout.write(
    pass
      ? `结论：颜色 100% 与字体无关；几何差异只出现在文字宽度撑开的盒子上（${(shiftRatio * 100).toFixed(2)}%，` +
          `最大位移 ${maxDelta}px），其余元素零位移\n`
      : `结论：字体替换后出现超出预期的差异（颜色 ${colorDiffs} 条，几何 ${(shiftRatio * 100).toFixed(2)}%，` +
          `最大位移 ${maxDelta}px）\n`,
  )
  return pass ? 0 : 1
}

async function main() {
  if (process.argv.includes('--help')) {
    printHelp()
    return 0
  }
  const fontProbe = process.argv.includes('--font-probe')
  const update = process.argv.includes('--update')
  if (!existsSync(DIST_ENTRY)) {
    process.stderr.write('缺少 dist/：请先运行 pnpm exec vite build（或 pnpm build）\n')
    return 1
  }
  const routes = selectRoutes(arg('routes'))
  const widths = selectWidths(arg('widths'))
  const apiPort = numberArg('api-port', Number(process.env.STUB_API_PORT) || 8150)
  const previewPort = numberArg('preview-port', 4250)
  const stub = await startStubApi({ port: apiPort })
  const preview = startPreview(stub.port, previewPort)
  const origin = `http://127.0.0.1:${previewPort}`
  let browser
  try {
    await waitForHttp(origin, 60000, preview.child, 'vite preview')
    const ignoreRaster = process.argv.includes('--ignore-raster')
    if (ignoreRaster) {
      process.stdout.write(
        '已关闭抗锯齿相关启动参数（--disable-lcd-text 等）：布局快照理应零差异\n',
      )
    }
    browser = await chromium.launch({ args: launchArgs(ignoreRaster) })
    const context = await browser.newContext(CONTEXT_OPTIONS)
    const page = await context.newPage()
    if (fontProbe) return await runFontProbe(page, origin, routes, widths)
    if (update) return await runUpdate(page, origin, routes, widths)
    return await runCompare(page, origin, routes, widths)
  } catch (error) {
    process.stderr.write(`布局快照运行失败：${error instanceof Error ? error.message : error}\n`)
    const stderr = preview.stderr()
    if (stderr) process.stderr.write(`vite preview 输出：\n${stderr}\n`)
    return 1
  } finally {
    if (browser) await browser.close()
    await stopChild(preview.child)
    await stub.close()
  }
}

try {
  process.exitCode = await main()
} catch (error) {
  process.stderr.write(`布局快照异常：${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
}
