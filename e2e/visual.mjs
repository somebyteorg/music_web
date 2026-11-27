/**
 * 像素级视觉回归。
 *
 *   pnpm test:visual:update                    # 生成/更新浅色 + 深色两套基线
 *   pnpm test:visual                           # 对比两套基线，超阈值退出码 1
 *   pnpm test:visual --theme=dark --scene=queue
 *
 * 流程：启动 mock 后端 → vite preview 托管 dist → Playwright 按「主题 × 宽度 × 目标」截图 →
 * pixelmatch + pngjs 对比。目标清单（5 条路由 × 3 个宽度 + 弹窗/队列/空态场景）在
 * ./visual/targets.mjs 里，阈值可用 --max-diff-ratio / --max-channel-delta 覆盖。
 */

import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startStubApi } from './stub-api.mjs'
import { comparePair } from './visual/compare.mjs'
import { startPreview, stopChild, waitForHttp } from './visual/server.mjs'
import { printPair, summarize } from './visual/report.mjs'
import {
  ROUTES,
  SCENES,
  THEMES,
  THEME_LABELS,
  VIEWPORT_HEIGHT,
  WIDTHS,
  parseList,
  shotName,
  themedName,
} from './visual/targets.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHOT_DIR = path.join(ROOT, 'e2e', '__shots__')
const ACTUAL_DIR = path.join(SHOT_DIR, 'actual')
const DIFF_DIR = path.join(SHOT_DIR, 'diff')
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.html')
const STORAGE_KEY = 'music-theme'

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

/** --theme 支持 light / dark / all（默认 all：浅色与深色各跑一套）。 */
function resolveThemes(raw) {
  const values = parseList(raw)
  if (!values.length || values.includes('all') || values.includes('both')) return THEMES
  const unknown = values.filter((value) => !THEMES.includes(value))
  if (unknown.length) throw new Error(`未知主题：${unknown.join(', ')}（可选 light / dark / all）`)
  return THEMES.filter((theme) => values.includes(theme))
}

function resolveWidths(raw) {
  const values = parseList(raw).map(Number)
  const picked = values.filter((value) => Number.isFinite(value) && value > 0)
  return picked.length ? picked : WIDTHS
}

/** 把「路由 × 宽度」与场景展开成一份待截图清单，按宽度分组复用同一个浏览器上下文。 */
function buildJobs(widths, routeFilter, sceneFilter) {
  const routes = routeFilter.length
    ? routeFilter.map((value) => ({ path: value, ready: '#main' }))
    : ROUTES
  const jobs = []
  for (const route of routes) {
    for (const width of widths) {
      jobs.push({ name: shotName(route.path, width), width, path: route.path, ready: route.ready })
    }
  }
  const scenes = sceneFilter.length
    ? SCENES.filter((scene) => sceneFilter.some((keyword) => scene.name.includes(keyword)))
    : SCENES
  for (const scene of scenes) {
    for (const width of scene.widths.filter((value) => widths.includes(value))) {
      jobs.push({ ...scene, width, name: `${scene.name}-${width}` })
    }
  }
  const grouped = new Map()
  for (const job of jobs) {
    if (!grouped.has(job.width)) grouped.set(job.width, [])
    grouped.get(job.width).push(job)
  }
  return grouped
}

async function settle(page) {
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
}

async function capture(page, origin, job, target) {
  // 侧边栏的两个播放器图标在后端不存在：统一用品牌图标占位，避免 broken image 干扰像素对比
  const icon = path.join(ROOT, 'public', 'favicon.svg')
  const stubIcon = (request) => request.fulfill({ path: icon, contentType: 'image/svg+xml' })
  await page.route(/\/web\/safari-pinned-tab\.svg$/, stubIcon)
  await page.route(/\/feishin\/assets\/128x128\.png$/, stubIcon)
  // 场景可以先把接口改成空数据，再让页面自己去渲染空态
  if (job.before) await job.before(page)
  await page.goto(`${origin}/#${job.path}`, { waitUntil: 'load' })
  await page.waitForSelector('.app-shell', { timeout: 15000 })
  await page.waitForSelector(job.ready, { timeout: 15000 })
  await settle(page)
  if (job.setup) {
    await job.setup(page)
    await settle(page)
  }
  await page.screenshot({
    path: target,
    fullPage: job.fullPage !== false,
    animations: 'disabled',
    caret: 'hide',
  })
}

async function createContext(browser, theme, width) {
  const context = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: theme,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  // 深色主题靠 localStorage 里的偏好固定住（index.html 的首屏脚本也读同一个键），
  // colorScheme 同时让原生控件（滚动条、日期选择器）进入深色。
  if (theme === 'dark') {
    await context.addInitScript((key) => localStorage.setItem(key, 'dark'), STORAGE_KEY)
  }
  return context
}

function printHelp() {
  process.stdout.write(
    [
      '用法：node e2e/visual.mjs [选项]',
      '',
      '  --update                    生成/更新基线',
      '  --theme=light|dark|all      主题，默认 all（浅色 + 深色各一套）',
      '  --max-diff-ratio=0.005      允许的差异像素占比',
      '  --max-channel-delta=20      允许的最大单通道差（0-255）',
      '  --api-port=8000             mock 后端端口',
      '  --preview-port=4173         vite preview 端口',
      '  --routes=/albums,/settings  只跑指定路由',
      '  --widths=390,768,1280       只跑指定宽度',
      '  --scene=queue,dialog        只跑名称命中关键词的场景',
      '',
    ].join('\n'),
  )
}

async function run() {
  const update = process.argv.includes('--update')
  const limits = {
    maxDiffRatio: numberArg('max-diff-ratio', 0.005),
    maxChannelDelta: numberArg('max-channel-delta', 20),
  }
  const apiPort = numberArg('api-port', Number(process.env.STUB_API_PORT) || 8000)
  const previewPort = numberArg('preview-port', 4173)
  const themes = resolveThemes(arg('theme'))
  const widths = resolveWidths(arg('widths'))
  const jobs = buildJobs(widths, parseList(arg('routes')), parseList(arg('scene')))

  await mkdir(SHOT_DIR, { recursive: true })
  if (!update) {
    await rm(ACTUAL_DIR, { recursive: true, force: true })
    await rm(DIFF_DIR, { recursive: true, force: true })
    await mkdir(ACTUAL_DIR, { recursive: true })
  }

  const stub = await startStubApi({ port: apiPort })
  const preview = startPreview(ROOT, apiPort, previewPort)
  const origin = `http://127.0.0.1:${previewPort}`
  let browser
  try {
    await waitForHttp(origin, 60000, preview.child, 'vite preview')
    // 端口被别的进程占着时 vite 会立刻退出，而 waitForHttp 可能已经连上「别人的」服务，
    // 那等于拿旧构建做对比：这里再确认一次子进程确实还活着。
    if (preview.child.exitCode !== null) {
      throw new Error(`vite preview 未能在本进程内启动（端口 ${previewPort} 可能被占用）`)
    }
    // 固定渲染环境：CI（macOS runner）与本机的字体抗锯齿/子像素渲染不同，
    // 不加这些参数会整页出现 1~2% 的文本像素差异、通道差可达 200+。
    browser = await chromium.launch({
      args: [
        '--disable-lcd-text',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--force-color-profile=srgb',
      ],
    })
    const captured = []
    for (const theme of themes) {
      for (const [width, widthJobs] of jobs) {
        const context = await createContext(browser, theme, width)
        for (const job of widthJobs) {
          const name = themedName(job.name, theme)
          const baselinePath = path.join(SHOT_DIR, `${name}.png`)
          const actualPath = path.join(update ? SHOT_DIR : ACTUAL_DIR, `${name}.png`)
          const page = await context.newPage()
          try {
            await capture(page, origin, job, actualPath)
          } finally {
            await page.close()
          }
          if (update) {
            process.stdout.write(`更新基线 ${name}.png\n`)
            continue
          }
          captured.push({ name, theme, baselinePath, actualPath })
        }
        await context.close()
      }
    }
    if (update) {
      const total = [...jobs.values()].reduce((sum, list) => sum + list.length, 0)
      process.stdout.write(
        `\n已写入 ${total * themes.length} 张基线到 e2e/__shots__` +
          `（${themes.map((theme) => THEME_LABELS[theme]).join(' + ')}）\n`,
      )
      return 0
    }
    const pairs = []
    for (const item of captured) {
      const pair = await comparePair(
        item.name,
        item.baselinePath,
        item.actualPath,
        limits,
        DIFF_DIR,
      )
      pairs.push({ ...pair, theme: item.theme })
      printPair(pair)
    }
    summarize(pairs, themes, limits)
    return pairs.every((pair) => pair.pass) ? 0 : 1
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

async function main() {
  if (process.argv.includes('--help')) {
    printHelp()
    return 0
  }
  if (!existsSync(DIST_ENTRY)) {
    process.stderr.write('缺少 dist/：请先运行 pnpm exec vite build（或 pnpm build）\n')
    return 1
  }
  try {
    return await run()
  } catch (error) {
    process.stderr.write(`视觉回归参数错误：${error instanceof Error ? error.message : error}\n`)
    return 1
  }
}

try {
  process.exitCode = await main()
} catch (error) {
  process.stderr.write(`视觉回归异常：${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
}
