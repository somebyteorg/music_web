/** tus-js-client 的按需加载入口：它约 90 kB，不该压在首屏入口 chunk 里 */
type TusModule = typeof import('tus-js-client')
export type TusUpload = InstanceType<TusModule['Upload']>

let tusModule: Promise<TusModule> | undefined

/**
 * 第一次真正传输时才拉取 tus 客户端。
 * 加载失败要说清楚是「上传组件没取到」，而不是静默失败或抛一个底层错误。
 */
export function loadTus(): Promise<TusModule> {
  if (!tusModule) {
    tusModule = import('tus-js-client').catch((error: unknown) => {
      tusModule = undefined
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`上传组件加载失败（${reason}），请检查网络后重试。`)
    })
  }
  return tusModule
}
