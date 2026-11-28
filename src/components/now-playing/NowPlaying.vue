<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import NowPlayingArtwork from './NowPlayingArtwork.vue'
import NowPlayingSide from './NowPlayingSide.vue'

/**
 * 全屏「歌词预览页」外壳：只负责开关、焦点、锁滚动、Esc，以及「舞台」的尺寸编排。
 * 舞台（.np-stage）是居中的一块定高区：桌面 min(78vh, 720px) 两栏等高，
 * 移动端 calc(100dvh - 2 * --space-6)，默认只有封面，点开歌词后变成「顶部一行 + 下方歌词」。
 * 左栏在 NowPlayingArtwork，右栏（歌词/队列）在 NowPlayingSide，页面本身不持有歌词状态。
 * z-index 60：压过播放器（45）与队列抽屉（46）。
 */
const player = usePlayerStore()
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const compact = useMediaQuery('(max-width: 899px)')

/** 移动端歌词态；桌面永远算"已展开" */
const lyricsOpen = computed(() => !compact.value || player.nowPlayingLyrics)

let origin: HTMLElement | null = null
let savedOverflow = ''
// html 也要锁：只锁 body 时根元素仍可滚动（滚动条会把浮层宽度挤窄 15~20px，背景也会跟着滚）
let savedRootOverflow = ''
let locked = false

function close() {
  player.closeNowPlaying()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !player.nowPlaying) return
  // 移动端歌词态：Esc 先退回封面态（与顶部小封面按钮同一个出口），再按一次才关页面
  if (compact.value && player.nowPlayingLyrics) {
    player.setNowPlayingLyrics(false)
    return
  }
  close()
}

watch(
  () => player.nowPlaying,
  async (open) => {
    if (open) {
      // 打开来源就是播放器的封面按钮，关掉时把焦点还给它
      const active = document.activeElement
      origin = active instanceof HTMLElement ? active : null
      savedOverflow = document.body.style.overflow
      savedRootOverflow = document.documentElement.style.overflow
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      locked = true
      await nextTick()
      closeButton.value?.focus()
      return
    }
    if (locked) {
      document.body.style.overflow = savedOverflow
      document.documentElement.style.overflow = savedRootOverflow
      locked = false
    }
    if (origin && origin.isConnected) origin.focus()
    origin = null
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (locked) {
    document.body.style.overflow = savedOverflow
    document.documentElement.style.overflow = savedRootOverflow
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="np">
      <div
        v-if="player.nowPlaying"
        aria-label="歌词预览"
        aria-modal="true"
        class="now-playing"
        role="dialog"
      >
        <button
          ref="closeButton"
          aria-label="关闭歌词预览"
          class="icon-button np-close"
          title="关闭"
          type="button"
          @click="close"
        >
          <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
        <div :class="['np-stage', { 'is-lyrics': compact && player.nowPlayingLyrics }]">
          <NowPlayingArtwork />
          <Transition name="np-side">
            <NowPlayingSide v-if="lyricsOpen" />
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@layer components {
  .now-playing {
    position: fixed;
    z-index: 60;
    inset: 0;
    display: grid;
    /* 舞台整体居中；尺寸由 .np-stage 自己定，两栏因此等高 */
    place-content: center;
    /* 舞台高度：桌面 min(78vh, 720px)，移动端整屏减去上下 padding（见媒体查询） */
    --np-stage-height: min(78vh, 720px);
    background: var(--scrim-strong);
    backdrop-filter: blur(24px);
    overflow: hidden;
  }
  .np-stage {
    display: grid;
    /* 左窄右宽：歌词列 1280×800 下约 660px */
    grid-template-columns: minmax(0, 42fr) minmax(0, 58fr);
    gap: var(--space-8);
    width: min(1180px, calc(100% - 2 * var(--space-8)));
    height: var(--np-stage-height);
    margin: auto;
  }
  .np-close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 1;
  }
  /* 歌词区进出：淡入 + 轻微上浮缩放（transform 不参与布局，不会挤动头部） */
  .np-side-enter-active,
  .np-side-leave-active {
    transition:
      opacity var(--motion-morph),
      transform var(--motion-morph);
  }
  .np-side-enter-from,
  .np-side-leave-to {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  /* 进出：淡入 + 轻微缩放；prefers-reduced-motion 由 @layer a11y 统一关掉 */
  .np-enter-active,
  .np-leave-active {
    transition:
      opacity var(--motion-morph),
      transform var(--motion-morph);
  }
  .np-enter-from,
  .np-leave-to {
    opacity: 0;
    transform: scale(0.97);
  }
  @media (max-width: 899px) {
    .now-playing {
      --np-stage-height: calc(100dvh - 2 * var(--space-6));
      padding: var(--space-6) var(--space-4);
    }
    /* 竖排：封面态整屏一栏；歌词态是「顶部一行信息 + 下方整块歌词」，两态都等高 */
    .np-stage {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      gap: var(--space-3);
      width: 100%;
    }
    /* 歌词态：header 自适应、歌词栏吃满剩余高度；
       顶部让出关闭按钮（40px 按钮 + 上下各 8），底部只留 --space-4 */
    .np-stage.is-lyrics {
      grid-template-rows: auto minmax(0, 1fr);
      align-content: stretch;
      row-gap: var(--space-3);
      padding-top: calc(var(--space-2) + 40px + var(--space-2));
      padding-bottom: var(--space-4);
    }
    .np-close {
      top: var(--space-2);
      right: var(--space-2);
    }
  }
}
</style>
