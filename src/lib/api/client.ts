import ky, { HTTPError } from 'ky'

/**
 * 全站唯一的 HTTP 出口。
 *
 * - 统一错误模型：所有失败都变成 ApiError（带 status 与响应体），调用方不必再猜
 * - 统一鉴权：CSRF 头注入、401 广播（会话过期）
 * - 统一取消：AbortError 原样抛出，交给调用方判断，不包装成"网络异常"
 */
export class ApiError extends Error {
  // 项目启用 erasableSyntaxOnly，不能用构造器参数属性
  readonly status: number
  readonly data: unknown

  constructor(message: string, status: number, data: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

let csrfToken = ''

export function setCsrfToken(value: string) {
  csrfToken = value
}

const STATUS_MESSAGE: Record<number, string> = {
  401: '先登录，再一起逛音乐库吧。',
  403: '没有权限执行这个操作。',
  404: '找不到这个资源。',
  409: '数据已被其他操作修改，请刷新后重试。',
  419: '页面已过期，请刷新后重试。',
  422: '提交的内容没有通过校验。',
  423: '这份资源正在处理，稍等一下再试。',
  429: '操作太频繁了，稍后再试。',
  500: '服务器出错了，请稍后重试。',
  502: '服务暂时不可用，请稍后重试。',
  503: '服务暂时不可用，请稍后重试。',
}

/** 裸 ky 实例：尚未迁移到类型化 api 模块的领域仍可用它，但共用同一套钩子 */
export const http = ky.create({
  prefixUrl: '/api',
  credentials: 'same-origin',
  retry: 0,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
  hooks: {
    beforeRequest: [
      (request) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && csrfToken)
          request.headers.set('X-CSRF-TOKEN', csrfToken)
      },
    ],
    afterResponse: [
      (_request, _options, response) => {
        if (response.status === 401) window.dispatchEvent(new Event('session-expired'))
      },
    ],
  },
})

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  json?: unknown
  searchParams?: Record<string, string | number | undefined>
  signal?: AbortSignal
  /** 覆盖默认 30s 超时（批量入库等长任务用） */
  timeoutMs?: number
}

/** 类型化请求：失败一律抛 ApiError（AbortError 除外） */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    const response = await http(path, {
      method: options.method ?? 'GET',
      json: options.json as never,
      searchParams: options.searchParams as never,
      signal: options.signal,
      ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}),
    })
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    throw await normalize(error)
  }
}

async function normalize(error: unknown): Promise<Error> {
  if (error instanceof Error && error.name === 'AbortError') return error
  if (error instanceof HTTPError) {
    const data = await error.response
      .clone()
      .json()
      .catch(() => null)
    const message =
      (data as { message?: string } | null)?.message ||
      STATUS_MESSAGE[error.response.status] ||
      `请求失败（${error.response.status}）`
    return new ApiError(message, error.response.status, data)
  }
  return new ApiError(error instanceof Error ? error.message : '网络异常，请稍后重试。', 0)
}
