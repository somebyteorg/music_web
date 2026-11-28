import { nextTick } from 'vue'
import type { Ref } from 'vue'

/**
 * FLIP：同一个元素从旧几何连续变形到新几何（不重新挂载、不换版式）。
 * run(mutate) 会先记下 first rect，执行 mutate 改变状态，等 DOM 更新后取 last rect，
 * 再用 WAAPI 做一次补偿动画；动画结束（或取消）清掉 will-change。
 * prefers-reduced-motion: reduce 时不做任何动画，直接切换。
 */
const DURATION = 320
const EASING = 'cubic-bezier(.22,.61,.36,1)'

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useFlipMorph(target: Ref<HTMLElement | null>) {
  let animation: Animation | null = null

  function settle(finished: Animation) {
    if (animation !== finished) return
    animation = null
    target.value?.style.removeProperty('will-change')
  }

  async function run(mutate: () => void) {
    const el = target.value
    if (!el || prefersReducedMotion()) {
      mutate()
      return
    }
    const first = el.getBoundingClientRect()
    mutate()
    await nextTick()
    const last = el.getBoundingClientRect()
    if (!first.width || !first.height || !last.width || !last.height) return
    const dx = first.left - last.left
    const dy = first.top - last.top
    const sx = first.width / last.width
    const sy = first.height / last.height
    if (
      Math.abs(dx) < 0.5 &&
      Math.abs(dy) < 0.5 &&
      Math.abs(sx - 1) < 0.001 &&
      Math.abs(sy - 1) < 0.001
    )
      return
    if (animation) {
      const stale = animation
      animation = null
      stale.cancel()
    }
    el.style.setProperty('will-change', 'transform')
    const current = el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          transformOrigin: 'top left',
        },
        { transform: 'none', transformOrigin: 'top left' },
      ],
      { duration: DURATION, easing: EASING },
    )
    animation = current
    current.addEventListener('finish', () => settle(current))
    current.addEventListener('cancel', () => settle(current))
  }

  function cancel() {
    animation?.cancel()
    animation = null
    target.value?.style.removeProperty('will-change')
  }

  return { run, cancel }
}
