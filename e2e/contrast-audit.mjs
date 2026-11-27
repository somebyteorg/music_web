/**
 * 对比度审计（WCAG 2.1 AA）：14 条路由 × 390/768/1280 × 浅色/深色。
 *
 *   pnpm test:contrast                                  # 浅色 + 深色，失败数必须为 0
 *   node e2e/contrast-audit.mjs --theme=light --routes=/settings --widths=1280
 *   node e2e/contrast-audit.mjs --json=contrast.json     # 附完整明细
 *
 * 判定口径：
 *   - 普通文本 ≥ 4.5:1；大字（≥18.66px，或 ≥14px 且字重 ≥700）≥ 3:1；
 *   - 图标（.ui-icon / svg 等非文本 UI）≥ 3:1；
 *   - 焦点环（:focus-visible 的 outline 用 --brand）对页面各级表面 ≥ 3:1。
 *
 * 背景不用「假设白底」，而是沿祖先链把带 alpha 的底色逐层合成（见 contrast-page.mjs）；
 * 渐变/图片底无法静态求值，单列「跳过」清单。禁用态按 WCAG 豁免排除。
 * 细边框类 token 的对比度只作参考打印，不计入失败。
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { collect } from './contrast-page.mjs'
import { startStubApi } from './stub-api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.html')
const VIEWPORT_HEIGHT = 900
const ROUTES = [
  { path: '/songs', ready: '.song-list' },
  { path: '/songs/1', ready: '.resources-card' },
  { path: '/albums', ready: '.catalog' },
  { path: '/albums/1', ready: '.detail-hero' },
  { path: '/artists', ready: '.catalog' },
  { path: '/artists/artist-1', ready: '.detail-hero' },
  { path: '/playlists', ready: '.catalog' },
  { path: '/playlists/pl-1', ready: '.detail-hero' },
  { path: '/libraries', ready: '.catalog' },
  { path: '/uploads', ready: '.pending-row' },
  { path: '/history', ready: '.history-list' },
  { path: '/members', ready: '.member-list' },
  { path: '/inbox', ready: '.message-list' },
  { path: '/settings', ready: '.library-options' },
]
const WIDTHS = [390, 768, 1280]

function arg(name) {
  const prefix = '--' + name + '='
  const hit = process.argv.find((value) => value.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function startPreview(apiPort, previewPort) {
  const child = spawn(
    path.join(ROOT, 'node_modules', '.bin', 'vite'),
    ['preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    { cwd: ROOT, env: { ...process.env, STUB_API_PORT: String(apiPort) }, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr = String(stderr + chunk).slice(-4000)
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
    if (child && child.exitCode !== null) throw new Error(label + ' 提前退出')
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // 还没起来，继续等
    }
    await delay(250)
  }
  throw new Error(label + ' 在 ' + timeoutMs + 'ms 内没有就绪')
}

/** 细边框参考值：同一 token 只报它在 --surface 上的比值，够一眼看出有多淡。 */
function uniqueBorders(pages) {
  const seen = new Map()
  for (const page of pages) {
    for (const item of page.borderAdvice) {
      if (item.surface !== '--surface') continue
      seen.set(item.token, item.token + ' ' + item.fg + ' = ' + item.ratio)
    }
  }
  return [...seen.values()]
}

/** 同一处失败在多个路由/宽度重复出现时合并成一行，方便定位要改的 token。 */
function group(items) {
  const merged = new Map()
  for (const item of items) {
    const key = [item.selector, item.kind, item.fg, item.bg, item.target].join('|')
    const hit = merged.get(key)
    if (hit) {
      hit.routes.add(item.route)
      hit.widths.add(item.width)
    } else {
      merged.set(key, { ...item, routes: new Set([item.route]), widths: new Set([item.width]) })
    }
  }
  return [...merged.values()].sort((a, b) => a.ratio - b.ratio)
}

function describe(item) {
  const tokens = item.tokens.length ? ' [' + item.tokens.join(' ') + ']' : ''
  const bgTokens = item.bgTokens.length ? ' on [' + item.bgTokens.join(' ') + ']' : ''
  return (
    String(item.ratio).padStart(5, ' ') + ' / ' + item.target + '  ' + item.fg + tokens + bgTokens +
    '  ' + item.selector + '  「' + item.text + '」  (' + item.kind + ' ' + item.fontSize + '/' + item.fontWeight + ')  ' +
    [...item.routes].join(',')
  )
}

async function audit(options) {
  const { themes, widths, routes, apiPort, previewPort, tokens } = options
  const stub = await startStubApi({ port: apiPort })
  const preview = startPreview(apiPort, previewPort)
  const origin = 'http://127.0.0.1:' + previewPort
  const pages = []
  let browser
  try {
    await waitForHttp(origin, 60000, preview.child, 'vite preview')
    browser = await chromium.launch({
      args: ['--disable-lcd-text', '--font-render-hinting=none', '--force-color-profile=srgb'],
    })
    for (const theme of themes) {
      for (const width of widths) {
        const context = await browser.newContext({
          viewport: { width, height: VIEWPORT_HEIGHT },
          deviceScaleFactor: 1,
          locale: 'zh-CN',
          colorScheme: theme,
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        })
        await context.addInitScript((value) => {
          window.localStorage.setItem('music-theme', value)
        }, theme)
        for (const route of routes) {
          const page = await context.newPage()
          try {
            await page.goto(origin + '/#' + route.path, { waitUntil: 'load' })
            await page.waitForSelector('.app-shell', { timeout: 15000 })
            await page.waitForSelector(route.ready, { timeout: 15000 })
            await page.waitForFunction(
              () => !document.querySelector('[aria-busy="true"], .skeleton'),
              undefined,
              { timeout: 15000 },
            )
            await page.evaluate(() => document.fonts.ready)
            await page.waitForTimeout(120)
            const result = await page.evaluate(collect, { tokens })
            pages.push({ theme, width, route: route.path, ...result })
          } finally {
            await page.close()
          }
        }
        await context.close()
      }
    }
  } finally {
    if (browser) await browser.close()
    await stopChild(preview.child)
    await stub.close()
  }
  return pages
}

async function main() {
  if (!existsSync(DIST_ENTRY)) {
    process.stderr.write('缺少 dist/：请先运行 pnpm exec vite build\n')
    return 1
  }
  const themes = (arg('theme') || 'light,dark').split(',').filter(Boolean)
  const widths = (arg('widths') || WIDTHS.join(',')).split(',').map(Number).filter(Boolean)
  const routes = arg('routes')
    ? arg('routes').split(',').map((value) => ({ path: value.trim(), ready: '#main' }))
    : ROUTES
  const css = await readFile(path.join(ROOT, 'src/styles/tokens-light.css'), 'utf8')
  const tokens = [...css.matchAll(/(--[a-z0-9-]+):/g)].map((match) => match[1])
  let pages
  try {
    pages = await audit({
      themes,
      widths,
      routes,
      apiPort: Number(arg('api-port') || 8114),
      previewPort: Number(arg('preview-port') || 4194),
      tokens,
    })
  } catch (error) {
    process.stderr.write('审计运行失败：' + (error instanceof Error ? error.message : error) + '\n')
    return 1
  }
  const jsonPath = arg('json')
  if (jsonPath) {
    const target = path.isAbsolute(jsonPath) ? jsonPath : path.join(ROOT, jsonPath)
    await writeFile(target, JSON.stringify(pages, null, 2))
  }
  let total = 0
  for (const theme of themes) {
    const scoped = pages.filter((entry) => entry.theme === theme)
    const failures = scoped.flatMap((entry) =>
      entry.failures.map((item) => ({ ...item, route: entry.route, width: entry.width })),
    )
    const skipped = scoped.flatMap((entry) => entry.skipped)
    const decorative = scoped.flatMap((entry) => entry.decorative)
    const rings = scoped.flatMap((entry) => entry.ringFailures.map((item) => ({ ...item, route: entry.route })))
    const ringFailures = [...new Map(rings.map((item) => [item.token, item])).values()]
    const stats = scoped.reduce(
      (acc, entry) => ({ text: acc.text + entry.stats.text, icon: acc.icon + entry.stats.icon }),
      { text: 0, icon: 0 },
    )
    const level = failures.length + ringFailures.length
    process.stdout.write(
      '\n=== ' + theme + '：' + scoped.length + ' 个页面，文本 ' + stats.text + ' 个、图标 ' + stats.icon +
        ' 个，失败 ' + level + '，装饰性封面文字（豁免）' + decorative.length + '，图片底跳过 ' + skipped.length + ' ===\n',
    )
    for (const item of group(failures)) process.stdout.write(describe(item) + '\n')
    for (const item of ringFailures) {
      process.stdout.write('  焦点环 ' + item.fg + ' 对 ' + item.token + ' = ' + item.ratio + '（需 ≥3）\n')
    }
    if (decorative.length) {
      const lowest = Math.min(...decorative.map((item) => item.ratio))
      process.stdout.write('  装饰性封面文字 ' + decorative.length + ' 处豁免，最低 ' + lowest + ':1\n')
    }
    const borders = uniqueBorders(scoped)
    if (borders.length) process.stdout.write('  参考（装饰性细边框，无 3:1 要求）：' + borders.join('  ') + '\n')
    const skippedSelectors = [...new Set(skipped.map((item) => item.selector))]
    if (skippedSelectors.length) process.stdout.write('  图片底跳过求值：' + skippedSelectors.join('、') + '\n')
    total += level
  }
  process.stdout.write('\n合计失败 ' + total + ' 项（阈值：正文 4.5，大字/图标/焦点环 3）\n')
  return total === 0 ? 0 : 1
}

try {
  process.exitCode = await main()
} catch (error) {
  process.stderr.write('审计异常：' + (error instanceof Error ? error.stack : error) + '\n')
  process.exitCode = 1
}
