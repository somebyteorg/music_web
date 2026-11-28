<script lang="ts" setup>
import { nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { useNowPlayingLyrics } from '@/composables/useNowPlayingLyrics'

/**
 * 预览页右栏：歌词列表。
 * 当前行高亮并滚到可视区中间；用户自己滚过之后 4 秒内不再自动拽回，
 * 否则一边读一边被拉走（体验关键）。
 */
const PAUSE_AFTER_SCROLL = 4000
/** 平滑滚动自己也会持续触发 scroll 事件，这段时间内的事件不算"用户滚动" */
const AUTO_SCROLL_WINDOW = 900

const { status, lines, activeIndex, message, retry } = useNowPlayingLyrics()

const list = useTemplateRef<HTMLOListElement>('list')
let pausedUntil = 0
let autoScrolling = false
let idleTimer = 0

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

// 歌词解析完成（含切歌）后先对到当前行
watch(lines, async () => {
  await nextTick()
  if (activeIndex.value >= 0) scrollToActive(activeIndex.value)
})

onMounted(() => {
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
    <ol v-else ref="list" class="np-lines" @scroll.passive="onScroll">
      <li
        v-for="(line, index) in lines"
        :key="index"
        :aria-current="index === activeIndex ? 'true' : undefined"
        :class="['np-line', { 'is-active': index === activeIndex }]"
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
    /* 父级网格是 justify-items: center，这里必须显式撑满列宽，否则歌词会缩成一条窄柱 */
    width: 100%;
    min-width: 0;
    min-height: 0;
    height: 100%;
    justify-self: stretch;
  }
  .np-lines {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: var(--space-7) var(--space-4);
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    scrollbar-gutter: stable;
  }
  .np-line {
    padding: var(--space-2) var(--space-3);
    color: var(--text-muted);
    font-size: 15px;
    line-height: 1.7;
    text-align: center;
    border-radius: var(--radius-md);
    transition:
      color var(--motion-morph),
      transform var(--motion-morph);
  }
  .np-line.is-active {
    color: var(--brand);
    font-weight: 600;
    transform: scale(1.05);
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
}
</style>
