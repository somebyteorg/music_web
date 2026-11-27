/** 视觉回归的两个子进程：mock 后端 + vite preview 托管 dist。 */

import { spawn } from 'node:child_process'
import path from 'node:path'

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function startPreview(root, apiPort, previewPort) {
  const viteBin = path.join(root, 'node_modules', '.bin', 'vite')
  const child = spawn(
    viteBin,
    ['preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    {
      cwd: root,
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
