<script lang="ts" setup>
import { nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { useNowPlayingLyrics } from '@/composables/useNowPlayingLyrics'
import { useScrollFade } from '@/composables/useScrollFade'

/**
 * 预览页右栏：歌词列表。
 * 当前行高亮并滚到可视区中间；用户自己滚过之后 4 秒内不再自动拽回，
 * 否则一边读一边被拉走（体验关键）。
 * 每行带一个 --d（离当前行的距离 0..5），越远越淡、越虚、越小，形成距离层次；
 * 没有时间轴的纯文本歌词 --d 恒为 0，整篇同亮度。
 */
const PAUSE_AFTER_SCROLL = 4000
/** 平滑滚动自己也会持续触发 scroll 事件，这段时间内的事件不算"用户滚动" */
const AUTO_SCROLL_WINDOW = 900
/** 层次最远到第 5 行，再远都按同一档 */
const MAX_DEPTH = 5

const { status, lines, activeIndex, message, retry } = useNowPlayingLyrics()

const list = useTemplateRef<HTMLOListElement>('list')
/** 滚动渐隐：贴顶/贴底/不可滚三态由共享 composable 维护（样式在 styles/components.css） */
const { refresh: refreshFade } = useScrollFade(list)
let pausedUntil = 0
let autoScrolling = false
let idleTimer = 0

function depth(index: number) {
  if (activeIndex.value < 0) return 0
  return Math.min(Math.abs(index - activeIndex.value), MAX_DEPTH)
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function scrollToActive(index: number) {
  const target = list.value?.children.item(index)
  if (!(target instanceof HTMLElement)) return
  autoScrolling = true
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    autoScrolling = false
  }, AUTO_SCROLL_WINDOW)
  target.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

function onScroll() {
  if (autoScrolling) return
  pausedUntil = Date.now() + PAUSE_AFTER_SCROLL
}

watch(activeIndex, (index) => {
  if (index < 0 || Date.now() < pausedUntil) return
  scrollToActive(index)
})

// 歌词解析完成（含切歌）后先对到当前行，并重算滚动渐隐
watch(lines, async () => {
  await nextTick()
  refreshFade()
  if (activeIndex.value >= 0) scrollToActive(activeIndex.value)
})

onMounted(() => {
  refreshFade()
  if (activeIndex.value >= 0) scrollToActive(activeIndex.value)
})
</script>

<template>
  <div class="np-lyrics">
    <p v-if="status === 'loading' || status === 'idle'" class="np-note">歌词加载中…</p>
    <div v-else-if="status === 'error'" class="np-note">
      <p>歌词加载失败，<button class="np-retry" type="button" @click="retry()">点此重试</button></p>
      <p v-if="message" class="np-detail">{{ message }}</p>
    </div>
    <p v-else-if="status === 'empty'" class="np-note">暂无歌词</p>
    <ol v-else ref="list" class="np-lines scroll-fade" @scroll.passive="onScroll">
      <li
        v-for="(line, index) in lines"
        :key="index"
        :aria-current="index === activeIndex ? 'true' : undefined"
        :class="['np-line', { 'is-active': index === activeIndex }]"
        :style="{ '--d': depth(index) }"
      >
        {{ line.text }}
      </li>
    </ol>
  </div>
</template>

<style scoped>
@layer components {
  .np-lyrics {
    display: flex;
    flex-direction: column;
    /* 父级是网格列：显式撑满列宽/列高，否则歌词会缩成一条窄柱 */
    width: 100%;
    min-width: 0;
    min-height: 0;
    height: 100%;
    justify-self: stretch;
    /* 字号桌面 22 / 当前行 24，移动端 17/1.75、当前行 19 */
    --np-line-size: 22px;
    --np-line-active-size: 24px;
    --np-line-height: 1.55;
    /* 距离层次：-0.16/行、模糊 0.3px/行、缩放 0.015/行（移动端在媒体查询里放缓） */
    --np-depth-fade: 0.16;
    --np-depth-blur: 0.3px;
    --np-depth-scale: 0.015;
  }
  .np-lines {
    flex: 1;
    min-height: 0;
    margin: 0;
    /* 上下留白给渐隐遮罩让位，滚到顶/底时不至于把第一行截掉 */
    padding: var(--space-7) var(--space-4);
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    scrollbar-gutter: stable;
  }
  .np-line {
    padding: 12px var(--space-3);
    color: var(--text-muted);
    font-size: var(--np-line-size);
    line-height: var(--np-line-height);
    text-align: center;
    border-radius: var(--radius-md);
    /* 距离层次：越远越淡 / 越虚 / 越小；--d 由模板按 |i - activeIndex| 给（0..5） */
    opacity: calc(1 - var(--d, 0) * var(--np-depth-fade));
    filter: blur(calc(var(--d, 0) * var(--np-depth-blur)));
    transform: scale(calc(1 - var(--d, 0) * var(--np-depth-scale)));
    transition:
      color var(--motion-morph),
      opacity var(--motion-morph),
      filter var(--motion-morph),
      transform var(--motion-morph);
  }
  .np-line.is-active {
    color: var(--brand);
    font-size: var(--np-line-active-size);
    font-weight: 600;
    opacity: 1;
    filter: none;
    transform: scale(1.04);
  }
  .np-note {
    margin: auto;
    padding: var(--space-6);
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.7;
    text-align: center;
  }
  .np-note p {
    margin: 0;
  }
  .np-retry {
    color: var(--brand);
    font-size: 14px;
    text-decoration: underline;
  }
  .np-detail {
    margin-top: var(--space-2);
    font-size: 11px;
    opacity: 0.7;
  }
  @media (max-width: 899px) {
    .np-lyrics {
      --np-line-size: 17px;
      --np-line-active-size: 19px;
      --np-line-height: 1.75;
      /* 移动端屏幕小，层次衰减放缓，避免远处几行直接糊成一片 */
      --np-depth-fade: 0.12;
      --np-depth-blur: 0.22px;
      --np-depth-scale: 0.012;
    }
    .np-lines {
      padding-block: var(--space-4);
      padding-inline: var(--space-2);
    }
    .np-line {
      padding: 10px var(--space-2);
    }
  }
}
</style>
