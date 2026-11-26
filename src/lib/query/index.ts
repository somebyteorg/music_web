import { onScopeDispose, ref, type Ref } from 'vue'

/**
 * 极简查询层：一套缓存 + 一次拉取 + 显式失效。
 *
 * - key 自带用户维度（调用方拼接 userId），登出时 clearQueryCache() 清空
 * - staleTime 内直接命中缓存（stale-while-revalidate 的"先用后刷"）
 * - 同一 key 的并发请求由 AbortController 取消前一次，避免旧响应覆盖新状态
 * - 不需要缓存、只要"取消上一次"的场景（一次性搜索、弹窗预览）用 useLatest，
 *   两套接口共用这里的错误文案与取消语义，全站只有这一份并发控制实现
 */
interface CacheEntry {
  data: unknown
  at: number
}

const cache = new Map<string, CacheEntry>()
const MAX_ENTRIES = 50

export function readCache<T>(key: string): (CacheEntry & { data: T }) | null {
  const hit = cache.get(key)
  return hit ? (hit as CacheEntry & { data: T }) : null
}

export function writeCache(key: string, data: unknown) {
  cache.delete(key)
  cache.set(key, { data, at: Date.now() })
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!)
}

/** 按 key 前缀失效（例如 'catalog:' 或 `${userId}:catalog`） */
export function invalidateQueries(prefixes: string[]) {
  for (const key of [...cache.keys()])
    if (prefixes.some((prefix) => key.startsWith(prefix))) cache.delete(key)
}

export function clearQueryCache() {
  cache.clear()
}

/** 错误文案只在这里定义一次：调用方拿到的 ref 与 useLatest 的 error 用词一致 */
function message(error: unknown) {
  return error instanceof Error ? error.message : '加载失败，请重试。'
}

export interface QueryOptions<T> {
  /** 返回 null 表示当前不该查询（例如未登录） */
  key: () => string | null
  fetcher: (signal: AbortSignal) => Promise<T>
  /** 命中缓存且未过期的静默时间，默认 30s */
  staleTime?: number
  /** 非取消类错误的回调（例如弹 toast）；error ref 里同时保留文案 */
  onError?: (error: unknown) => void
}

export function useQuery<T>(options: QueryOptions<T>) {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref('')
  const busy = ref(false)
  const updatedAt = ref(0)
  let controller: AbortController | undefined

  async function run(force = false) {
    const key = options.key()
    if (!key) return
    const cached = readCache<T>(key)
    if (cached) {
      data.value = cached.data
      updatedAt.value = cached.at
    }
    const fresh = !!cached && Date.now() - cached.at < (options.staleTime ?? 30_000)
    if (fresh && !force) {
      error.value = ''
      return
    }
    controller?.abort()
    const request = new AbortController()
    controller = request
    busy.value = true
    error.value = ''
    try {
      const result = await options.fetcher(request.signal)
      if (request.signal.aborted) return
      data.value = result
      updatedAt.value = Date.now()
      writeCache(key, result)
    } catch (e) {
      if (request.signal.aborted) return
      error.value = message(e)
      options.onError?.(e)
    } finally {
      if (!request.signal.aborted) busy.value = false
    }
  }

  onScopeDispose(() => controller?.abort())

  return { data, error, busy, updatedAt, run }
}

export interface LatestOptions {
  /** 非取消类错误的回调（例如弹 toast）；error ref 里同时保留文案 */
  onError?: (error: unknown) => void
}

export type LatestOutcome<T> =
  { status: 'done'; data: T } | { status: 'canceled' } | { status: 'failed'; error: unknown }

/**
 * 轻量"只保留最新一次"请求：没有 key，也没有缓存。
 *
 * - 连续触发时取消上一次，旧请求即使晚到也不会写回状态
 * - 取消不算错误；错误收进 error ref（需要提示时传 onError）
 * - 组件卸载 / 作用域销毁时取消在途请求
 */
export function useLatest(options: LatestOptions = {}) {
  const busy = ref(false)
  const error = ref('')
  let controller: AbortController | undefined

  function cancel() {
    controller?.abort()
    controller = undefined
  }

  async function run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<LatestOutcome<T>> {
    cancel()
    const request = new AbortController()
    controller = request
    const { signal } = request
    busy.value = true
    error.value = ''
    try {
      const data = await task(signal)
      return signal.aborted ? { status: 'canceled' } : { status: 'done', data }
    } catch (e) {
      if (signal.aborted) return { status: 'canceled' }
      error.value = message(e)
      options.onError?.(e)
      return { status: 'failed', error: e }
    } finally {
      if (!signal.aborted) busy.value = false
    }
  }

  onScopeDispose(cancel)

  return { busy, error, run, cancel }
}
