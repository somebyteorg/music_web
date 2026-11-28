<script lang="ts" setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { CSSProperties } from 'vue'

/**
 * 唯一的一份跑马灯实现（播放器小窗、全屏歌词页都复用它，禁止再写第二份）。
 * 行为对齐旧站 music.emos.best 的 .marquee 体系：
 * - 文本宽度 > 容器宽度才滚（scrollWidth > clientWidth 才加 is-overflowing）
 * - 首尾间隔 gap 默认 28px（旧站 --marquee-line-padding），用一份 aria-hidden 副本做无缝循环
 * - 速度按像素算：35px/s，duration = (textWidth + gap) / 35，下限 6s
 * - 滚动时左右两侧渐隐（mask，与歌词列表同一个手法）
 * - 悬停 / 聚焦暂停；prefers-reduced-motion: reduce 时不滚，退回省略号
 * ResizeObserver 跟随容器宽度变化（小窗 168px ↔ 收起 82px）重新量宽。
 */
const props = withDefaults(defineProps<{ text?: string; duration?: number; gap?: number }>(), {
  text: '',
  duration: 0,
  gap: 28,
})

const PIXELS_PER_SECOND = 35
const MIN_SECONDS = 6

const box = useTemplateRef<HTMLSpanElement>('box')
const chunk = useTemplateRef<HTMLSpanElement>('chunk')
const overflowing = ref(false)
const textWidth = ref(0)
const reduced = ref(false)

const seconds = computed(() => {
  if (props.duration > 0) return props.duration
  return Math.max(MIN_SECONDS, (textWidth.value + props.gap) / PIXELS_PER_SECOND)
})

const style = computed<CSSProperties>(() => ({
  '--marquee-gap': `${props.gap}px`,
  '--marquee-duration': `${seconds.value.toFixed(2)}s`,
}))

let motion: MediaQueryList | null = null
let observer: ResizeObserver | null = null

function measure() {
  const track = chunk.value
  const view = box.value
  if (!track || !view) return
  textWidth.value = track.scrollWidth
  // reduce 下一律不滚，交给 CSS 的省略号
  overflowing.value = !reduced.value && track.scrollWidth > view.clientWidth + 0.5
}

function onMotionChange(event: MediaQueryListEvent | MediaQueryList) {
  reduced.value = event.matches
  measure()
}

onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange(motion)
  motion.addEventListener('change', onMotionChange)
  observer = new ResizeObserver(measure)
  if (box.value) observer.observe(box.value)
})

onBeforeUnmount(() => {
  motion?.removeEventListener('change', onMotionChange)
  observer?.disconnect()
})

watch(
  () => props.text,
  async () => {
    await nextTick()
    measure()
  },
)
</script>

<template>
  <span
    ref="box"
    :class="['marquee', { 'is-overflowing': overflowing }]"
    :style="style"
    :tabindex="overflowing ? 0 : undefined"
  >
    <span class="marquee-track">
      <span ref="chunk" class="marquee-chunk">{{ text }}</span>
      <span v-if="overflowing" aria-hidden="true" class="marquee-chunk marquee-chunk--copy">{{
        text
      }}</span>
    </span>
  </span>
</template>

<style scoped>
@layer components {
  .marquee {
    display: block;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }
  /* 不溢出：保持普通一行，真超长也还是省略号 */
  .marquee-track {
    display: flex;
    width: 100%;
    min-width: 0;
  }
  .marquee-chunk {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* 溢出：两块等宽 + 首尾间隔，周期正好是轨道宽度的一半，translateX(-50%) 即无缝 */
  .marquee.is-overflowing .marquee-track {
    width: max-content;
    animation: marquee-scroll var(--marquee-duration) linear infinite;
  }
  .marquee.is-overflowing .marquee-chunk {
    flex: 0 0 auto;
    overflow: visible;
    padding-inline-end: var(--marquee-gap);
  }
  /* 两侧渐隐，与歌词列表同一套 mask 手法 */
  .marquee.is-overflowing {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 16px,
      #000 calc(100% - 16px),
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent 0,
      #000 16px,
      #000 calc(100% - 16px),
      transparent 100%
    );
  }
  .marquee.is-overflowing:hover .marquee-track,
  .marquee.is-overflowing:focus .marquee-track {
    animation-play-state: paused;
  }
  @keyframes marquee-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .marquee.is-overflowing {
      -webkit-mask-image: none;
      mask-image: none;
    }
    .marquee.is-overflowing .marquee-track {
      width: 100%;
      animation: none;
    }
    .marquee.is-overflowing .marquee-chunk {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-inline-end: 0;
    }
  }
}
</style>
