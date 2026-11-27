/**
 * 前端错误采集：归一化 → 本地环形缓冲 → 去重 / 限流 → 上报。
 *
 * 只解决一件事：线上的 JS 错误能被看到。发送端是任意 POST 端点（VITE_ERROR_ENDPOINT），
 * 未配置时**只在内存里留痕**（最近 50 条），不是静默吞错——开发/排障可以用 getRecentErrors 读。
 */

export interface TelemetryContext {
  [key: string]: string | number | boolean | null | undefined
}

/** 一条错误记录：字段固定，方便后端直接落库或按字段聚合 */
export interface ErrorRecord {
  message: string
  stack: string
  url: string
  route: string
  userAgent: string
  /** ISO 时间戳 */
  at: string
  context: TelemetryContext
}

/** 一次上报的去向：sent 真的发出去了，其余三种都只进本地缓冲 */
export type ReportOutcome = 'sent' | 'buffered' | 'duplicated' | 'throttled'

/** 环形缓冲容量：最近 50 条 */
const RING_SIZE = 50
/** 同一指纹的去重窗口：10 分钟 */
const DEDUPE_WINDOW_MS = 10 * 60_000
/** 限流窗口与配额：每分钟最多 10 条 */
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 10
/** 指纹取 stack 的前 40 个字符（行号不同、尾部不同也算同一处） */
const FINGERPRINT_STACK_LENGTH = 40

const ring: ErrorRecord[] = []
const lastSentAt = new Map<string, number>()
const sentTimes: number[] = []
let installed = false

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message || error.name
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const value = error.message
    if (typeof value === 'string') return value
  }
  return String(error)
}

function stackOf(error: unknown): string {
  if (error instanceof Error && typeof error.stack === 'string') return error.stack
  if (typeof error === 'object' && error !== null && 'stack' in error) {
    const value = error.stack
    if (typeof value === 'string') return value
  }
  return ''
}

function locationOf(): { url: string; route: string } {
  if (typeof window === 'undefined') return { url: '', route: '' }
  const { href, hash } = window.location
  return { url: href, route: hash.startsWith('#') ? hash.slice(1) : hash }
}

function userAgentOf(): string {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent
}

/** 归一化：任何形状的 error 都变成同一条记录，调用方不必先判断类型 */
export function normalizeError(error: unknown, context: TelemetryContext = {}): ErrorRecord {
  const { url, route } = locationOf()
  return {
    message: messageOf(error),
    stack: stackOf(error),
    url,
    route,
    userAgent: userAgentOf(),
    at: new Date().toISOString(),
    context: { ...context },
  }
}

/** 端点来自构建时注入的环境变量；空串表示「未配置」，此时不发送 */
function endpointOf(): string {
  const value: unknown = import.meta.env.VITE_ERROR_ENDPOINT
  return typeof value === 'string' ? value.trim() : ''
}

/** 指纹 = message + stack 前 40 字：同一处代码反复抛错只发一次 */
export function fingerprintOf(record: ErrorRecord): string {
  return `${record.message}\u0000${record.stack.slice(0, FINGERPRINT_STACK_LENGTH)}`
}

function buffer(record: ErrorRecord) {
  ring.push(record)
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE)
}

/** 只清掉过期状态：窗口外的指纹记录必须回收，否则 Map 会一直长 */
function prune(now: number) {
  while (sentTimes.length && now - sentTimes[0] >= RATE_WINDOW_MS) sentTimes.shift()
  for (const [key, at] of lastSentAt) if (now - at >= DEDUPE_WINDOW_MS) lastSentAt.delete(key)
}

/** sendBeacon 优先（页面卸载也能发）；不可用或队列满时退回 keepalive fetch */
function transmit(endpoint: string, record: ErrorRecord) {
  const body = JSON.stringify(record)
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
    if (sent) return
  }
  if (typeof fetch !== 'function') return
  void fetch(endpoint, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' },
    keepalive: true,
  }).catch(() => undefined)
}

function dispatch(endpoint: string, record: ErrorRecord): ReportOutcome {
  const now = Date.now()
  prune(now)
  const key = fingerprintOf(record)
  const previous = lastSentAt.get(key)
  if (previous !== undefined && now - previous < DEDUPE_WINDOW_MS) return 'duplicated'
  if (sentTimes.length >= RATE_LIMIT) return 'throttled'
  transmit(endpoint, record)
  lastSentAt.set(key, now)
  sentTimes.push(now)
  return 'sent'
}

/**
 * 上报一条错误。返回去向，调用方一般不用管：
 * - 未配置端点 → buffered（记录仍在环形缓冲里）
 * - 10 分钟内同一指纹 → duplicated
 * - 一分钟内已发满 10 条 → throttled
 */
export function reportError(error: unknown, context: TelemetryContext = {}): ReportOutcome {
  const record = normalizeError(error, context)
  buffer(record)
  const endpoint = endpointOf()
  if (!endpoint) return 'buffered'
  return dispatch(endpoint, record)
}

/** 最近 50 条，最新在前；只读拷贝，调用方改不到内部缓冲 */
export function getRecentErrors(): ErrorRecord[] {
  return ring
    .slice()
    .reverse()
    .map((record) => ({ ...record, context: { ...record.context } }))
}

/**
 * 装全局钩子：window.onerror + unhandledrejection。
 * 幂等——重复调用只装一次；SSR / 单测里没有 window 时直接返回。
 * Vue 渲染错误不经过这两个钩子，由 main.ts 的 app.config.errorHandler 单独接。
 */
export function installTelemetry() {
  if (installed || typeof window === 'undefined') return
  installed = true
  const previous = window.onerror
  window.onerror = (message, source, lineno, colno, error) => {
    reportError(error === undefined ? message : error, {
      source: 'window.onerror',
      file: source,
      line: lineno,
      column: colno,
    })
    // 不吞掉既有处理：浏览器控制台的默认输出仍然保留
    return typeof previous === 'function' ? previous(message, source, lineno, colno, error) : false
  }
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'unhandledrejection' })
  })
}
