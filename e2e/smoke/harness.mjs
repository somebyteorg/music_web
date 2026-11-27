/**
 * 冒烟的浏览器脚手架：mock 后端 + vite preview + Chromium，失败截图。
 *
 * 端口与布局快照错开（冒烟 8160/4260，布局 8150/4250），CI 里串行执行也不会互相抢端口。
 * 复用 layout/harness.mjs 的稳定渲染参数与进程收尾工具。
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import {
  CONTEXT_OPTIONS,
  LAUNCH_ARGS,
  ROOT,
  stopChild,
  waitForHttp,
} from '../layout/harness.mjs'

export { CONTEXT_OPTIONS, LAUNCH_ARGS, ROOT, stopChild, waitForHttp }

export const API_PORT = 8160
export const PREVIEW_PORT = 4260
export const SCREENSHOT_DIR = path.join(ROOT, 'e2e', '__smoke__')

/** preview 同时把 /api 与 tus 的 /upload 指向同一个 mock 后端（端口由脚手架给定） */
export function startPreview(apiPort, previewPort) {
  const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite')
  const child = spawn(
    viteBin,
    ['preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        STUB_API_PORT: String(apiPort),
        STUB_TUS_PORT: String(apiPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4000)
  })
  return { child, stderr: () => stderr }
}

export function arg(name) {
  const prefix = `--${name}=`
  const hit = process.argv.find((value) => value.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

export function numberArg(name, fallback) {
  const value = Number(arg(name))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** 打开 hash 路由并等骨架出现；具体断言各自的就绪条件由流程自己等 */
export async function openApp(page, origin, route) {
  await page.goto(`${origin}/#${route}`, { waitUntil: 'load' })
  await page.waitForSelector('.app-shell', { timeout: 15000 })
}

export async function screenshot(page, name) {
  await mkdir(SCREENSHOT_DIR, { recursive: true })
  const file = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

/** 断言失败时把实际值写进错误信息，排查时不用再猜 */
export function expectCount(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}：期望 ${expected}，实际 ${actual}`)
  return actual
}

export function expectText(actual, expected, label) {
  const value = actual.trim()
  if (value !== expected) throw new Error(`${label}：期望「${expected}」，实际「${value}」`)
  return value
}

export function expectIncludes(list, expected, label) {
  if (!list.includes(expected))
    throw new Error(`${label}：期望包含「${expected}」，实际 ${JSON.stringify(list)}`)
  return expected
}
