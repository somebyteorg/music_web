/**
 * 详情页曲目解耦的真机验证：
 *   -- 曲目接口 500：hero 正常 + 曲目区错误/重试
 *   -- 详情接口 500：整页错误态
 *   -- 正常：hero + 曲目列表 + 播放全部
 *
 * 用法：node e2e/verify-detail-tracks.mjs [--api-port=8200] [--preview-port=4190]
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { startStubApi } from './stub-api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHOT_DIR = path.join(ROOT, 'e2e', '__shots__', 'detail-tracks')
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
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-4000)
  })
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })
  return { child, stderr: () => stderr, stdout: () => stdout }
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(5000)])
  if (child.exitCode === null) child.kill('SIGKILL')
}

async function waitForHttp(url, timeoutMs, child, label) {
  const startedAt = Date.now()
  let lastError = ''
  while (Date.now() - startedAt < timeoutMs) {
    if (child && child.exitCode !== null) throw new Error(`${label} 提前退出`)
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await delay(250)
  }
  throw new Error(`${label} 在 ${timeoutMs}ms 内没有就绪（最后错误：${lastError}）`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function newPage(browser, origin) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(`${origin}/#/albums/1`, { waitUntil: 'load' })
  await page.waitForSelector('.app-shell', { timeout: 15000 })
  return { context, page, pageErrors }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`), fullPage: true })
}

async function songs500(browser, origin) {
  const { context, page, pageErrors } = await newPage(browser, origin)
  try {
    await page.waitForSelector('.detail-hero', { timeout: 15000 })
    await page.waitForSelector('.tracks-error', { timeout: 15000 })
    const title = (await page.locator('.detail-hero h1').innerText()).trim()
    assert(title === '夜航', `hero 标题不正确：${title}`)
    assert((await page.locator('.detail-hero .cover').count()) === 1, 'hero 封面缺失')
    const description = await page.locator('.detail-hero .description p').innerText()
    assert(description.includes('夜间飞行'), 'hero 简介缺失')
    assert((await page.locator('.ui-placeholder').count()) === 0, '曲目失败不应变成整页空态')
    const errorText = await page.locator('.tracks-error').innerText()
    assert(errorText.includes('曲目加载失败（模拟）'), `曲目错误文案不正确：${errorText}`)
    const retry = page.getByRole('button', { name: '重试' })
    assert((await retry.count()) === 1, '曲目区缺少重试按钮')
    const retryResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/catalog/songs') && response.url().includes('album_id'),
    )
    await retry.click()
    assert((await (await retryResponse).status()) === 500, '重试没有重新请求曲目接口')
    await page.waitForSelector('.tracks-error', { timeout: 15000 })
    assert(pageErrors.length === 0, `存在 pageerror：${pageErrors.join(' | ')}`)
    // spec #3：曲目未 ready 时 hasSongs=false，播放全部按钮隐藏（“未知”而非“0 首”）
    const playAll = await page.getByRole('button', { name: /播放全部/ }).count()
    await shot(page, 'songs-500')
    return { name: 'songs-500', title, description: 'present', retry: 'ok', playAll, pageErrors }
  } finally {
    await context.close()
  }
}

async function detail500(browser, origin) {
  const { context, page, pageErrors } = await newPage(browser, origin)
  try {
    await page.waitForSelector('.ui-placeholder', { timeout: 15000 })
    const text = await page.locator('.ui-placeholder').innerText()
    assert(text.includes('未找到资料'), `整页错误标题不正确：${text}`)
    assert(text.includes('详情加载失败（模拟）'), `整页错误文案不正确：${text}`)
    assert((await page.locator('.detail-hero').count()) === 0, '详情失败时不应渲染 hero')
    assert((await page.getByRole('button', { name: '重新加载' }).count()) === 1, '缺少整页重试')
    assert(pageErrors.length === 0, `存在 pageerror：${pageErrors.join(' | ')}`)
    await shot(page, 'detail-500')
    return { name: 'detail-500', text: '未找到资料', pageErrors }
  } finally {
    await context.close()
  }
}

async function normal(browser, origin) {
  const { context, page, pageErrors } = await newPage(browser, origin)
  try {
    await page.waitForSelector('.detail-hero', { timeout: 15000 })
    await page.waitForSelector('.song-list', { timeout: 15000 })
    assert((await page.locator('.tracks-error').count()) === 0, '正常场景不应出现曲目错误')
    assert((await page.locator('.ui-placeholder').count()) === 0, '正常场景不应出现空态')
    assert(
      (await page.getByRole('button', { name: /播放全部/ }).count()) === 1,
      '正常场景缺少播放全部按钮',
    )
    assert(pageErrors.length === 0, `存在 pageerror：${pageErrors.join(' | ')}`)
    await shot(page, 'normal')
    return { name: 'normal', songs: await page.locator('.song-list .song-row').count(), pageErrors }
  } finally {
    await context.close()
  }
}

async function main() {
  if (!existsSync(DIST_ENTRY)) {
    process.stderr.write('缺少 dist/：请先运行 pnpm exec vite build\n')
    return 1
  }
  await mkdir(SHOT_DIR, { recursive: true })
  const apiPort = arg('api-port', 8200)
  const previewPort = arg('preview-port', 4195)
  const stub = await startStubApi({ port: apiPort, failure: 'none' })
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
    const results = []
    stub.setFailure('songs')
    results.push(await songs500(browser, origin))
    stub.setFailure('detail')
    results.push(await detail500(browser, origin))
    stub.setFailure('none')
    results.push(await normal(browser, origin))
    for (const result of results)
      process.stdout.write(`PASS ${result.name} ${JSON.stringify(result)}\n`)
    process.stdout.write(`\n截图目录：${SHOT_DIR}\n`)
    return 0
  } catch (error) {
    process.stderr.write(`FAIL ${error instanceof Error ? error.message : error}\n`)
    const stderr = preview.stderr()
    const stdout = preview.stdout()
    if (stdout) process.stderr.write(`vite preview stdout：\n${stdout}\n`)
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
  process.stderr.write(`验证异常：${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
}
