/**
 * 端到端冒烟：三条主链路跑在构建产物（vite preview）上，后端是 stub-api。
 *
 *   pnpm test:smoke                          # 默认 8160 / 4260
 *   node e2e/smoke/run.mjs --api-port=9160 --preview-port=5260
 *
 * 失败会把整页截图写到 e2e/__smoke__/<流程名>.png，并打印 mock 后端与 preview 的输出。
 */
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { startStubApi } from '../stub-api.mjs'
import {
  API_PORT,
  CONTEXT_OPTIONS,
  LAUNCH_ARGS,
  PREVIEW_PORT,
  ROOT,
  numberArg,
  screenshot,
  startPreview,
  stopChild,
  waitForHttp,
} from './harness.mjs'
const FLOWS_DIR = path.join(ROOT, 'e2e', 'smoke', 'flows')
const DIST_ENTRY = path.join(ROOT, 'dist', 'index.html')

/** flows/ 下一个文件一条链路，脚本自动发现：新增链路不用改这里 */
async function loadFlows() {
  const names = (await readdir(FLOWS_DIR)).filter((name) => name.endsWith('.mjs')).sort()
  const flows = []
  for (const name of names) {
    const module = await import(new URL(`./flows/${name}`, import.meta.url))
    if (module.flow) flows.push(module.flow)
    else process.stderr.write(`跳过 ${name}：没有导出 flow\n`)
  }
  return flows
}

/** 证据打印：把嵌套对象压成 key = value 行，失败时也能看出断到哪一步 */
function describe(value, prefix = '') {
  const lines = []
  for (const [key, item] of Object.entries(value)) {
    if (item && typeof item === 'object' && !Array.isArray(item))
      lines.push(...describe(item, `${prefix}${key}.`))
    else lines.push(`${prefix}${key} = ${JSON.stringify(item)}`)
  }
  return lines
}

async function runFlows(flows, context, origin, stub) {
  const failures = []
  for (const flow of flows) {
    const page = await context.newPage()
    const startedAt = Date.now()
    try {
      const evidence = await flow.run({ page, origin, stub })
      process.stdout.write(`✓ ${flow.title}  ${Date.now() - startedAt}ms\n`)
      for (const line of describe(evidence)) process.stdout.write(`    ${line}\n`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push({ name: flow.name, message })
      process.stderr.write(`✗ ${flow.title}\n    ${message}\n`)
      try {
        const file = await screenshot(page, flow.name)
        process.stderr.write(`    截图：${path.relative(ROOT, file)}\n`)
      } catch (captureError) {
        const reason = captureError instanceof Error ? captureError.message : captureError
        process.stderr.write(`    截图失败：${reason}\n`)
      }
    } finally {
      await page.close()
    }
  }
  return failures
}

async function main() {
  if (!existsSync(DIST_ENTRY)) {
    process.stderr.write('缺少 dist/：请先运行 pnpm exec vite build\n')
    return 1
  }
  const flows = await loadFlows()
  if (!flows.length) {
    process.stderr.write('e2e/smoke/flows 下没有可运行的链路\n')
    return 1
  }
  const apiPort = numberArg('api-port', API_PORT)
  const previewPort = numberArg('preview-port', PREVIEW_PORT)
  const stub = await startStubApi({ port: apiPort })
  const preview = startPreview(stub.port, previewPort)
  const origin = `http://127.0.0.1:${previewPort}`
  const failures = []
  let browser
  try {
    await waitForHttp(origin, 60000, preview.child, 'vite preview')
    browser = await chromium.launch({ args: LAUNCH_ARGS })
    const context = await browser.newContext(CONTEXT_OPTIONS)
    failures.push(...(await runFlows(flows, context, origin, stub)))
    await context.close()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`冒烟运行失败：${message}\n`)
    const stderr = preview.stderr()
    if (stderr) process.stderr.write(`vite preview 输出：\n${stderr}\n`)
    failures.push({ name: 'bootstrap', message })
  } finally {
    if (browser) await browser.close()
    await stopChild(preview.child)
    await stub.close()
  }
  process.stdout.write(`\n冒烟结果：${flows.length - failures.length}/${flows.length} 通过\n`)
  return failures.length ? 1 : 0
}

try {
  process.exitCode = await main()
} catch (error) {
  process.stderr.write(`冒烟异常：${error instanceof Error ? error.stack : error}\n`)
  process.exitCode = 1
}
