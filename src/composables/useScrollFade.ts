import { onBeforeUnmount, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * 滚动渐隐：给滚动容器挂三个状态类，遮罩样式统一在 styles/components.css 里。
 * 纵轴（默认）= .scroll-fade：
 *   is-scrollable  内容超过一屏（scrollHeight > clientHeight + 1）
 *   is-at-top      贴顶（scrollTop <= 1）
 *   is-at-bottom   贴底（scrollTop + clientHeight >= scrollHeight - 1）
 * 横轴（axis: 'x'，首页横向楼层用）= .scroll-fade-x：
 *   is-scrollable-x / is-at-start / is-at-end
 * 内容变化（歌词解析完成、队列增删）导致尺寸变了不会触发 ResizeObserver，调 refresh() 重算。
 */
const EDGE = 1

export type ScrollAxis = 'y' | 'x'

const CLASS_NAMES: Record<ScrollAxis, { scrollable: string; start: string; end: string }> = {
  y: { scrollable: 'is-scrollable', start: 'is-at-top', end: 'is-at-bottom' },
  x: { scrollable: 'is-scrollable-x', start: 'is-at-start', end: 'is-at-end' },
}

export function useScrollFade(target: Ref<HTMLElement | null>, axis: ScrollAxis = 'y') {
  const names = CLASS_NAMES[axis]
  let el: HTMLElement | null = null
  let observer: ResizeObserver | null = null

  function refresh() {
    if (!el) return
    const scroll = axis === 'y' ? el.scrollHeight : el.scrollWidth
    const client = axis === 'y' ? el.clientHeight : el.clientWidth
    const offset = axis === 'y' ? el.scrollTop : el.scrollLeft
    el.classList.toggle(names.scrollable, scroll > client + EDGE)
    el.classList.toggle(names.start, offset <= EDGE)
    el.classList.toggle(names.end, offset + client >= scroll - EDGE)
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
