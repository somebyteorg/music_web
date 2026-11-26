import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * 极简查询层：一套缓存 + 一次拉取 + 显式失效。
 *
 * - key 自带用户维度（调用方拼接 userId），登出时 clearQueryCache() 清空
 * - staleTime 内直接命中缓存（stale-while-revalidate 的"先用后刷"）
 * - 同一 key 的并发请求由 AbortController 取消前一次，避免旧响应覆盖新状态
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

export interface QueryOptions<T> {
  /** 返回 null 表示当前不该查询（例如未登录） */
  key: () => string | null
  fetcher: (signal: AbortSignal) => Promise<T>
  /** 命中缓存且未过期的静默时间，默认 30s */
  staleTime?: number
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
      error.value = e instanceof Error ? e.message : '加载失败，请重试。'
    } finally {
      if (!request.signal.aborted) busy.value = false
    }
  }

  onBeforeUnmount(() => controller?.abort())

  return { data, error, busy, updatedAt, run }
}
