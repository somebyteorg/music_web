<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 标题超长时无缝滚动：滚完一整圈回到原位后停留，再继续。
 * 复制一份文本用于无缝（复制件对辅助技术隐藏），因此循环点没有跳变。
 */
const props = withDefaults(
  defineProps<{
    text?: string | null
    /** 滚动速度，像素/秒 */
    speed?: number
    /** 两份文本之间的间隔，像素 */
    gap?: number
    /** 回到原位后的停留时长，毫秒 */
    hold?: number
    /** 首次开始滚动前的停顿，毫秒 */
    lead?: number
  }>(),
  { text: '', speed: 45, gap: 48, hold: 2600, lead: 800 },
)

const host = ref<HTMLElement>()
const track = ref<HTMLElement>()
const copy = ref<HTMLElement>()
const scrolling = ref(false)
/** 仅在「正在位移」时给两侧渐隐；停在原位时左侧不该吃字 */
const moving = ref(false)
let animation: Animation | null = null
let observer: ResizeObserver | null = null
let frame = 0
let ticker = 0
let leadMs = 0
let scrollMs = 0
let totalMs = 0

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function stop() {
  cancelAnimationFrame(ticker)
  ticker = 0
  moving.value = false
  animation?.cancel()
  animation = null
}

/** 按动画自身的 currentTime 判断当前处于滚动段还是停留段，避免定时器漂移 */
function follow() {
  const current = animation
  if (!current) return
  const elapsed = Number(current.currentTime ?? 0) - leadMs
  moving.value = elapsed >= 0 && elapsed % totalMs < scrollMs
  ticker = requestAnimationFrame(follow)
}

function measure() {
  cancelAnimationFrame(frame)
  // 等一帧，确保文本变化与布局都已完成
  frame = requestAnimationFrame(() => {
    const box = host.value
    const first = copy.value
    if (!box || !first) return
    stop()
    const overflow = first.scrollWidth > box.clientWidth + 1
    const next = overflow && !reducedMotion()
    if (next !== scrolling.value) scrolling.value = next
    if (!next) return
    requestAnimationFrame(start)
  })
}

function start() {
  const box = host.value
  const rail = track.value
  const first = copy.value
  if (!box || !rail || !first) return
  stop()
  // 位移「文本宽 + 间隔」时，复制件正好落在起点，视觉上即回到原位
  const distance = first.scrollWidth + props.gap
  leadMs = props.lead
  scrollMs = (distance / props.speed) * 1000
  totalMs = scrollMs + props.hold
  animation = rail.animate(
    [
      { transform: 'translateX(0)', offset: 0 },
      { transform: `translateX(-${distance}px)`, offset: scrollMs / totalMs },
      { transform: `translateX(-${distance}px)`, offset: 1 },
    ],
    { duration: totalMs, delay: leadMs, iterations: Infinity, easing: 'linear' },
  )
  cancelAnimationFrame(ticker)
  follow()
}

watch(
  () => [props.text, props.speed, props.gap, props.hold],
  () => {
    stop()
    measure()
  },
)

onMounted(() => {
  measure()
  document.fonts?.ready.then(measure).catch(() => {})
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    if (host.value) observer.observe(host.value)
    if (copy.value) observer.observe(copy.value)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  observer = null
  stop()
})
</script>

<template>
  <strong
    ref="host"
    :class="['scrolling-title', { 'is-scrolling': scrolling, 'is-moving': moving }]"
    :title="text || undefined"
  >
    <span ref="track" class="title-track">
      <span ref="copy" class="title-text">{{ text }}</span>
      <span v-if="scrolling" aria-hidden="true" class="title-text duplicate">{{ text }}</span>
    </span>
  </strong>
</template>

<style scoped>
/* 裁剪在容器上，动画在轨道上——两者必须是不同元素 */
.scrolling-title {
  display: block;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
}
.title-track {
  display: inline-block;
  white-space: nowrap;
  vertical-align: top;
}
.title-text {
  display: inline-block;
  white-space: nowrap;
}
/* 不滚动时（越界但关闭动效）：省略号收尾。
   轨道必须变成 block 才能拿到容器宽度，否则取消 max-width 约束后省略号不会出现。 */
.scrolling-title:not(.is-scrolling) .title-track {
  display: block;
  max-width: 100%;
  overflow: hidden;
}
.scrolling-title:not(.is-scrolling) .title-text {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.duplicate {
  margin-left: var(--scrolling-gap, 48px);
}
.scrolling-title.is-scrolling .title-track {
  will-change: transform;
}
/* 超长标题：右侧始终渐隐（末端随时可能被裁），左侧只在位移时渐隐 */
.scrolling-title.is-scrolling {
  -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 12px), transparent 100%);
  mask-image: linear-gradient(90deg, #000 calc(100% - 12px), transparent 100%);
}
.scrolling-title.is-scrolling.is-moving {
  -webkit-mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 12px,
    #000 calc(100% - 12px),
    transparent 100%
  );
  mask-image: linear-gradient(
    90deg,
    transparent 0,
    #000 12px,
    #000 calc(100% - 12px),
    transparent 100%
  );
}
</style>
