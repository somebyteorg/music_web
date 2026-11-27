/**
 * 应用骨架的焦点回归验证（拆分 App.vue 后防止丢失）：
 *   -- 390px 下点顶栏汉堡按钮：侧栏抽屉展开、aria-expanded=true
 *   -- 按 Esc：抽屉收起，document.activeElement 仍是汉堡 <button>
 *   -- 全程无 pageerror
 *
 * 用法：node e2e/verify-shell-focus.mjs [--api-port=8300] [--preview-port=4300]
 * 注：preview 端口不要用 4190 —— Node 的 fetch 会按 forbidden port 规则拒绝（bad port）。
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startStubApi } from './stub-api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.html')

function arg(name, fallback) {
  const prefix = `--${name}=`
  const hit = process.argv.find((value) => value.startsWith(prefix))
  return hit ? Number(hit.slice(prefix.length)) : fallback
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  if (!existsSync(DIST_ENTRY)) {
    process.stderr.write('缺少 dist/：请先运行 pnpm exec vite build\n')
    return 1
  }
  const apiPort = arg('api-port', 8300)
  const previewPort = arg('preview-port', 4300)
  const stub = await startStubApi({ port: apiPort })
  const preview = startPreview(apiPort, previewPort)
  const origin = `http://127.0.0.1:${previewPort}`
  let browser
  try {
    await waitForHttp(origin, 60000, preview.child, 'vite preview')
    browser = await chromium.launch({
      args: [
        '--disable-lcd-text',
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--force-color-profile=srgb',
      ],
    })
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      colorScheme: 'light',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(String(error)))
    // 侧边栏的两个播放器图标在后端不存在：统一用品牌图标占位
    const icon = path.join(ROOT, 'public', 'favicon.svg')
    const stubIcon = (request) => request.fulfill({ path: icon, contentType: 'image/svg+xml' })
    await page.route(/\/web\/safari-pinned-tab\.svg$/, stubIcon)
    await page.route(/\/feishin\/assets\/128x128\.png$/, stubIcon)
    await page.goto(`${origin}/#/albums`, { waitUntil: 'load' })
    await page.waitForSelector('.app-shell', { timeout: 15000 })
    await page.waitForSelector('.catalog', { timeout: 15000 })
    const burger = page.locator('button[aria-label="打开导航"]')
    const sidebar = page.locator('#app-navigation')
    assert(await burger.isVisible(), '390px 下汉堡按钮应可见')
    assert(!(await sidebar.evaluate((el) => el.classList.contains('expanded'))), '初始状态抽屉应收起')
    await burger.click()
    await page.waitForFunction(
      () => document.querySelector('#app-navigation')?.classList.contains('expanded') === true,
    )
    assert((await burger.getAttribute('aria-expanded')) === 'true', '展开后 aria-expanded 应为 true')
    await page.keyboard.press('Escape')
    await page.waitForFunction(
      () => document.querySelector('#app-navigation')?.classList.contains('expanded') === false,
    )
    const active = await page.evaluate(() => {
      const element = document.activeElement
      return {
        tagName: element?.tagName ?? null,
        ariaLabel: element?.getAttribute('aria-label') ?? null,
        isBurger: element === document.querySelector('button[aria-label="打开导航"]'),
      }
    })
    assert(active.tagName === 'BUTTON', `Esc 后焦点应在按钮上，实际是 ${active.tagName}`)
    assert(active.isBurger, `Esc 后焦点应回到汉堡按钮，实际是 ${active.ariaLabel}`)
    assert(pageErrors.length === 0, `页面出现错误：${pageErrors.join(' | ')}`)
    process.stdout.write('导航焦点回归：通过（390px 抽屉展开 → Esc 收起 → 焦点回到汉堡按钮）\n')
    return 0
  } catch (error) {
    process.stderr.write(`导航焦点回归失败：${error instanceof Error ? error.message : error}\n`)
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
  process.stderr.write(`导航焦点回归异常：${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
}
