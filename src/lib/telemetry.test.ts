import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Telemetry = typeof import('@/lib/telemetry')

const ENDPOINT = 'https://errors.example/collect'

type ErrorHandler = (
  message: string | Event,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: unknown,
) => unknown

interface FakeWindow {
  onerror: ErrorHandler | null
  addEventListener: (type: string, handler: (event: { reason: unknown }) => void) => void
  location: { href: string; hash: string }
}

interface Setup {
  telemetry: Telemetry
  fakeWindow: FakeWindow
  listeners: Map<string, (event: { reason: unknown }) => void>
  beacon: ReturnType<typeof vi.fn>
  fetchMock: ReturnType<typeof vi.fn>
}

/** 固定 stack，避免不同调用点导致指纹不同 */
function errorWith(message: string, stack: string) {
  const error = new Error(message)
  error.stack = stack
  return error
}

/** 每次重置模块：环形缓冲、指纹表、限流窗口都是模块级状态 */
async function setup(options: { endpoint?: string; beacon?: boolean } = {}): Promise<Setup> {
  vi.resetModules()
  const listeners = new Map<string, (event: { reason: unknown }) => void>()
  const fakeWindow: FakeWindow = {
    onerror: null,
    addEventListener: (type, handler) => {
      listeners.set(type, handler)
    },
    location: { href: 'http://127.0.0.1:4260/#/albums', hash: '#/albums' },
  }
  const beacon = vi.fn((_url: string, _data: Blob) => true)
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(new Response(null, { status: 204 })),
  )
  vi.stubGlobal('window', fakeWindow)
  vi.stubGlobal(
    'navigator',
    options.beacon === false
      ? { userAgent: 'vitest-agent' }
      : { userAgent: 'vitest-agent', sendBeacon: beacon },
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_ERROR_ENDPOINT', options.endpoint === undefined ? '' : options.endpoint)
  const telemetry = await import('@/lib/telemetry')
  return { telemetry, fakeWindow, listeners, beacon, fetchMock }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('telemetry 指纹去重', () => {
  it('同一 message + stack 前 40 字只发一次，但两条都进缓冲', async () => {
    const { telemetry, beacon } = await setup({ endpoint: ENDPOINT })
    const stack = 'Error: boom\n    at handleClick (app.js:10:5)'
    expect(telemetry.reportError(errorWith('boom', stack))).toBe('sent')
    expect(telemetry.reportError(errorWith('boom', stack))).toBe('duplicated')
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(telemetry.getRecentErrors()).toHaveLength(2)
  })

  it('前 40 字相同、尾部不同的 stack 视为同一指纹', async () => {
    const { telemetry } = await setup({ endpoint: ENDPOINT })
    const head = 'A'.repeat(40)
    expect(telemetry.reportError(errorWith('boom', head + 'tail-1'))).toBe('sent')
    expect(telemetry.reportError(errorWith('boom', head + 'tail-2'))).toBe('duplicated')
  })

  it('message 不同就是不同指纹', async () => {
    const { telemetry, beacon } = await setup({ endpoint: ENDPOINT })
    telemetry.reportError(errorWith('boom', 'stack'))
    telemetry.reportError(errorWith('bam', 'stack'))
    expect(beacon).toHaveBeenCalledTimes(2)
  })

  it('满 10 分钟后同一指纹重新上报', async () => {
    const { telemetry, beacon } = await setup({ endpoint: ENDPOINT })
    const stack = 'Error: boom\n    at handleClick (app.js:10:5)'
    telemetry.reportError(errorWith('boom', stack))
    vi.advanceTimersByTime(10 * 60_000 - 1)
    expect(telemetry.reportError(errorWith('boom', stack))).toBe('duplicated')
    vi.advanceTimersByTime(1)
    expect(telemetry.reportError(errorWith('boom', stack))).toBe('sent')
    expect(beacon).toHaveBeenCalledTimes(2)
  })
})

describe('telemetry 限流', () => {
  it('每分钟最多发 10 条，超出只入缓冲', async () => {
    const { telemetry, beacon } = await setup({ endpoint: ENDPOINT })
    const outcomes = Array.from({ length: 11 }, (_, index) =>
      telemetry.reportError(errorWith('boom ' + (index + 1), 'stack')),
    )
    expect(outcomes.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 'sent'))
    expect(outcomes[10]).toBe('throttled')
    expect(beacon).toHaveBeenCalledTimes(10)
    expect(telemetry.getRecentErrors()).toHaveLength(11)
  })

  it('过了限流窗口重新放行', async () => {
    const { telemetry, beacon } = await setup({ endpoint: ENDPOINT })
    for (let index = 0; index < 10; index += 1)
      telemetry.reportError(errorWith('boom ' + index, 'stack'))
    expect(telemetry.reportError(errorWith('boom later', 'stack'))).toBe('throttled')
    vi.advanceTimersByTime(60_000)
    expect(telemetry.reportError(errorWith('boom later', 'stack'))).toBe('sent')
    expect(beacon).toHaveBeenCalledTimes(11)
  })
})

describe('telemetry 未配置端点', () => {
  it('不发送、只写本地缓冲，记录字段完整', async () => {
    const { telemetry, beacon, fetchMock } = await setup()
    const outcome = telemetry.reportError(errorWith('boom', 'stack'), { source: 'smoke' })
    expect(outcome).toBe('buffered')
    expect(beacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    const recent = telemetry.getRecentErrors()
    expect(recent).toHaveLength(1)
    const record = recent[0]
    expect(record.message).toBe('boom')
    expect(record.stack).toBe('stack')
    expect(record.url).toBe('http://127.0.0.1:4260/#/albums')
    expect(record.route).toBe('/albums')
    expect(record.userAgent).toBe('vitest-agent')
    expect(record.at).toBe('2026-01-01T00:00:00.000Z')
    expect(record.context).toEqual({ source: 'smoke' })
  })

  it('环形缓冲只留最近 50 条，最新在前', async () => {
    const { telemetry } = await setup()
    for (let index = 0; index < 60; index += 1) telemetry.reportError('错误 ' + index)
    const recent = telemetry.getRecentErrors()
    expect(recent).toHaveLength(50)
    expect(recent[0].message).toBe('错误 59')
    expect(recent[49].message).toBe('错误 10')
  })
})

describe('telemetry 传输降级', () => {
  it('sendBeacon 可用时走 sendBeacon', async () => {
    const { telemetry, beacon, fetchMock } = await setup({ endpoint: ENDPOINT })
    expect(telemetry.reportError(errorWith('boom', 'stack'))).toBe('sent')
    expect(beacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    const [url, blob] = beacon.mock.calls[0]
    expect(url).toBe(ENDPOINT)
    expect(blob).toBeInstanceOf(Blob)
  })

  it('sendBeacon 不可用退回 keepalive fetch', async () => {
    const { telemetry, fetchMock } = await setup({ endpoint: ENDPOINT, beacon: false })
    expect(telemetry.reportError(errorWith('boom', 'stack'))).toBe('sent')
    expect(fetchMock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({ method: 'POST', keepalive: true }),
    )
  })
})

describe('telemetry 全局钩子', () => {
  it('window.onerror 与 unhandledrejection 都汇总到同一条链路', async () => {
    const { telemetry, fakeWindow, listeners, beacon } = await setup({ endpoint: ENDPOINT })
    telemetry.installTelemetry()
    expect(typeof fakeWindow.onerror).toBe('function')
    expect(listeners.has('unhandledrejection')).toBe(true)
    fakeWindow.onerror?.('手工抛错', 'app.js', 3, 7, errorWith('手工抛错', 'stack'))
    listeners.get('unhandledrejection')?.({ reason: new Error('异步炸了') })
    const errors = telemetry.getRecentErrors()
    expect(errors).toHaveLength(2)
    expect(errors[0].message).toBe('异步炸了')
    expect(errors[1].context).toMatchObject({
      source: 'window.onerror',
      file: 'app.js',
      line: 3,
      column: 7,
    })
    expect(beacon).toHaveBeenCalledTimes(2)
  })

  it('重复安装只装一次', async () => {
    const { telemetry, fakeWindow } = await setup()
    telemetry.installTelemetry()
    const first = fakeWindow.onerror
    telemetry.installTelemetry()
    expect(fakeWindow.onerror).toBe(first)
  })
})
