/**
 * 布局快照的浏览器脚手架：mock 后端、vite preview、稳定渲染参数、路由就绪判定。
 * 渲染环境与 e2e/visual.mjs 保持一致（同 5 条路由、同 3 个宽度），所以两类基线描述的是同一批页面。
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const ROUTES = [
  { path: '/albums', ready: '.catalog' },
  { path: '/albums/1', ready: '.detail-hero' },
  { path: '/songs/1', ready: '.resources-card' },
  { path: '/uploads', ready: '.pending-row' },
  { path: '/settings', ready: '.library-options' },
]
export const WIDTHS = [390, 768, 1280]
export const VIEWPORT_HEIGHT = 900

/** 关掉 LCD 次像素、强制 sRGB；--hide-scrollbars 让滚动条不参与布局（CI 的滚动条宽度与本机不同）。 */
export const LAUNCH_ARGS = [
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  '--disable-lcd-text',
  '--font-render-hinting=none',
  '--disable-font-subpixel-positioning',
]

export const CONTEXT_OPTIONS = {
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
}

export function arg(name) {
  const prefix = `--${name}=`
  const hit = process.argv.find((value) => value.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

export function numberArg(name, fallback) {
  const raw = arg(name) ?? process.env[name.toUpperCase().replaceAll('-', '_')]
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function startPreview(apiPort, previewPort) {
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

export async function stopChild(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(5000)])
  if (child.exitCode === null) child.kill('SIGKILL')
}

export async function waitForHttp(url, timeoutMs, child, label) {
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

/** 侧栏两个播放器图标在后端不存在，统一用品牌图标占位，避免 broken image 影响几何。 */
export async function stubStaticIcons(page) {
  const icon = path.join(ROOT, 'public', 'favicon.svg')
  const stubIcon = (request) => request.fulfill({ path: icon, contentType: 'image/svg+xml' })
  await page.route(/\/web\/safari-pinned-tab\.svg$/, stubIcon)
  await page.route(/\/feishin\/assets\/128x128\.png$/, stubIcon)
}

/** 打开路由并等到「数据到位、骨架消失、图片完成、字体就绪、两帧之后」。 */
export async function openRoute(page, origin, route) {
  await stubStaticIcons(page)
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
}
