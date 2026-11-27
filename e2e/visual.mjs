/**
 * 像素级视觉回归。
 *
 *   pnpm test:visual:update   # 生成/更新基线（e2e/__shots__/<route>-<width>.png）
 *   pnpm test:visual          # 对比当前构建与基线，超阈值退出码 1
 *
 * 流程：启动 mock 后端 → vite preview 托管 dist → Playwright 按 routes × widths 截图 →
 * pixelmatch + pngjs 对比。阈值可用 --max-diff-ratio / --max-channel-delta 覆盖。
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { chromium } from 'playwright'
import { startStubApi } from './stub-api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHOT_DIR = path.join(ROOT, 'e2e', '__shots__')
const ACTUAL_DIR = path.join(SHOT_DIR, 'actual')
const DIFF_DIR = path.join(SHOT_DIR, 'diff')
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.html')
const VIEWPORT_HEIGHT = 900

const ROUTES = [
  { path: '/albums', ready: '.catalog' },
  { path: '/albums/1', ready: '.detail-hero' },
  { path: '/songs/1', ready: '.resources-panel' },
  { path: '/uploads', ready: '.pending-row' },
  { path: '/settings', ready: '.library-options' },
]
const WIDTHS = [390, 768, 1280]

function arg(name) {
  const prefix = `--${name}=`
  const hit = process.argv.find((value) => value.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

function numberArg(name, fallback) {
  const raw = arg(name) ?? process.env[name.toUpperCase().replaceAll('-', '_')]
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shotName(route, width) {
  const slug = route
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'root'}-${width}`
}

function formatSize(png) {
  return `${png.width}x${png.height}`
}

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

async function comparePair(name, baselinePath, actualPath, limits) {
  if (!existsSync(baselinePath)) return { name, missing: true, pass: false }
  const baseline = PNG.sync.read(await readFile(baselinePath))
  const actual = PNG.sync.read(await readFile(actualPath))
  const sizeOk = baseline.width === actual.width && baseline.height === actual.height
  if (!sizeOk) {
    return { name, sizeOk, pass: false, diffRatio: 1, maxDelta: 255, size: formatSize(actual) }
  }
  const diff = new PNG({ width: baseline.width, height: baseline.height })
  const changed = pixelmatch(baseline.data, actual.data, diff.data, baseline.width, baseline.height, {
    threshold: 0.1,
  })
  const diffRatio = baseline.width * baseline.height ? changed / (baseline.width * baseline.height) : 0
  const delta = maxChannelDelta(baseline.data, actual.data)
  if (changed > 0) {
    await mkdir(DIFF_DIR, { recursive: true })
    await writeFile(path.join(DIFF_DIR, `${name}.png`), PNG.sync.write(diff))
  }
  const pass = diffRatio <= limits.maxDiffRatio && delta <= limits.maxChannelDelta
  return { name, sizeOk, pass, diffRatio, maxDelta: delta, size: formatSize(actual) }
}

function startPreview(apiPort, previewPort) {
  const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite')
  const child = spawn(
    viteBin,
    ['preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    {
      cwd: ROOT,
      env: { ...process.env, STUB_API_PORT: String(apiPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })
  return { child, stderr: () => stderr }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(5000)])
  if (child.exitCode === null) child.kill('SIGKILL')
}

async function waitForHttp(url, timeoutMs, child, label) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (child && child.exitCode !== null) throw new Error(`${label} 提前退出`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      /* 还没起来，继续等 */
    }
    await delay(250)
  }
  throw new Error(`${label} 在 ${timeoutMs}ms 内没有就绪`)
}

async function capture(page, origin, route, target) {
  // 侧边栏的两个播放器图标在后端不存在：统一用品牌图标占位，避免 broken image 干扰像素对比
  const icon = path.join(ROOT, 'public', 'favicon.svg')
  const stubIcon = (request) => request.fulfill({ path: icon, contentType: 'image/svg+xml' })
  await page.route(/\/web\/safari-pinned-tab\.svg$/, stubIcon)
  await page.route(/\/feishin\/assets\/128x128\.png$/, stubIcon)
  await page.goto(`${origin}/#${route.path}`, { waitUntil: 'load' })
  await page.waitForSelector('.app-shell', { timeout: 15000 })
  await page.waitForSelector(route.ready, { timeout: 15000 })
  await page.waitForFunction(
    () => {
      if (document.querySelector('[aria-busy="true"], .skeleton')) return false
      return Array.from(document.images).every((image) => image.complete)
    },
    undefined,
    { timeout: 15000 },
  )
  await page.evaluate(() =>
    document.fonts.ready.then(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    ),
  )
  await page.waitForTimeout(120)
  await page.screenshot({ path: target, fullPage: true, animations: 'disabled', caret: 'hide' })
}

function printHelp() {
  process.stdout.write(
    [
      '用法：node e2e/visual.mjs [选项]',
      '',
      '  --update                    生成/更新基线',
      '  --max-diff-ratio=0.005      允许的差异像素占比',
      '  --max-channel-delta=20      允许的最大单通道差（0-255）',
      '  --api-port=8000             mock 后端端口',
      '  --preview-port=4173         vite preview 端口',
      '  --routes=/albums,/settings  只跑指定路由',
      '  --widths=390,768,1280       只跑指定宽度',
      '',
    ].join('\n'),
  )
}

async function main() {
  if (process.argv.includes('--help')) {
    printHelp()
    return 0
  }
  if (!existsSync(DIST_ENTRY)) {
    process.stderr.write('缺少 dist/：请先运行 pnpm exec vite build（或 pnpm build）\n')
    return 1
  }
  const update = process.argv.includes('--update')
  const limits = {
    maxDiffRatio: numberArg('max-diff-ratio', 0.005),
    maxChannelDelta: numberArg('max-channel-delta', 20),
  }
  const apiPort = numberArg('api-port', Number(process.env.STUB_API_PORT) || 8000)
  const previewPort = numberArg('preview-port', 4173)
  const routeFilter = arg('routes')
  const widthFilter = arg('widths')
  const routes = routeFilter
    ? routeFilter
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => ({ path: value, ready: '#main' }))
    : ROUTES
  const widths = widthFilter
    ? widthFilter.split(',').map(Number).filter((value) => Number.isFinite(value) && value > 0)
    : WIDTHS

  await mkdir(SHOT_DIR, { recursive: true })
  if (!update) {
    await rm(ACTUAL_DIR, { recursive: true, force: true })
    await rm(DIFF_DIR, { recursive: true, force: true })
    await mkdir(ACTUAL_DIR, { recursive: true })
  }

  const stub = await startStubApi({ port: apiPort })
  const preview = startPreview(apiPort, previewPort)
  const origin = `http://127.0.0.1:${previewPort}`
  let browser
  try {
    await waitForHttp(origin, 60000, preview.child, 'vite preview')
    browser = await chromium.launch()
    const results = []
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: 1,
        locale: 'zh-CN',
        timezoneId: 'Asia/Shanghai',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      })
      for (const route of routes) {
        const name = shotName(route.path, width)
        const target = update
          ? path.join(SHOT_DIR, `${name}.png`)
          : path.join(ACTUAL_DIR, `${name}.png`)
        const page = await context.newPage()
        try {
          await capture(page, origin, route, target)
        } finally {
          await page.close()
        }
        if (update) process.stdout.write(`更新基线 ${name}.png\n`)
        else results.push({ name, path: path.join(SHOT_DIR, `${name}.png`), actual: target })
      }
      await context.close()
    }
    if (update) {
      process.stdout.write(`\n已写入 ${widths.length * routes.length} 张基线到 e2e/__shots__\n`)
      return 0
    }
    const pairs = []
    for (const result of results) {
      pairs.push(await comparePair(result.name, result.path, result.actual, limits))
    }
    for (const pair of pairs) {
      if (pair.missing) {
        process.stdout.write(`${pair.name.padEnd(28)} 缺少基线，请先 pnpm test:visual:update\n`)
        continue
      }
      const ratio = (pair.diffRatio * 100).toFixed(4)
      process.stdout.write(
        `${pair.name.padEnd(28)} 尺寸 ${pair.size} ${pair.sizeOk ? '一致' : '不一致'}  ` +
          `差异 ${ratio}%  最大通道差 ${pair.maxDelta}  ${pair.pass ? '通过' : '失败'}\n`,
      )
    }
    const failed = pairs.filter((pair) => !pair.pass)
    process.stdout.write(
      `\n共 ${pairs.length} 对，通过 ${pairs.length - failed.length}，失败 ${failed.length}` +
        `（阈值：差异 ≤ ${(limits.maxDiffRatio * 100).toFixed(3)}%，通道差 ≤ ${limits.maxChannelDelta}）\n`,
    )
    if (failed.length) {
      process.stdout.write(`失败：${failed.map((pair) => pair.name).join(', ')}\n`)
      process.stdout.write('实际截图：e2e/__shots__/actual，差异图：e2e/__shots__/diff\n')
      return 1
    }
    return 0
  } catch (error) {
    process.stderr.write(`视觉回归运行失败：${error instanceof Error ? error.message : error}\n`)
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
  process.stderr.write(`视觉回归异常：${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
}
