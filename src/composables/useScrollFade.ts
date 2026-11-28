import { onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * 滚动渐隐：给滚动容器挂三个状态类，遮罩样式统一在 styles/components.css 的 .scroll-fade 里。
 *   is-scrollable  内容超过一屏（scrollHeight > clientHeight + 1）
 *   is-at-top      贴顶（scrollTop <= 1）
 *   is-at-bottom   贴底（scrollTop + clientHeight >= scrollHeight - 1）
 * 内容变化（歌词解析完成、队列增删）导致高度变了不会触发 ResizeObserver，调 refresh() 重算。
 */
const EDGE = 1

export function useScrollFade(target: Ref<HTMLElement | null>) {
  let el: HTMLElement | null = null
  let observer: ResizeObserver | null = null

  function refresh() {
    if (!el) return
    const scrollable = el.scrollHeight > el.clientHeight + EDGE
    el.classList.toggle('is-scrollable', scrollable)
    el.classList.toggle('is-at-top', el.scrollTop <= EDGE)
    el.classList.toggle('is-at-bottom', el.scrollTop + el.clientHeight >= el.scrollHeight - EDGE)
  }

  function detach() {
    if (!el) return
    el.removeEventListener('scroll', refresh)
    observer?.disconnect()
    observer = null
    el = null
  }

  function attach(next: HTMLElement | null) {
    detach()
    if (!next) return
    el = next
    next.addEventListener('scroll', refresh, { passive: true })
    observer = new ResizeObserver(refresh)
    observer.observe(next)
    refresh()
  }

  watch(target, (value) => attach(value), { immediate: true })
  onBeforeUnmount(detach)

  return { refresh }
}
