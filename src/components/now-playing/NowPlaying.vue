<script lang="ts" setup>
import { nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import NowPlayingArtwork from './NowPlayingArtwork.vue'
import NowPlayingSide from './NowPlayingSide.vue'

/**
 * 全屏「歌词预览页」外壳：只负责开关、焦点、锁滚动、Esc 与两栏编排。
 * 左栏在 NowPlayingArtwork，右栏（歌词/队列）在 NowPlayingSide，页面本身不持有歌词状态。
 * z-index 60：压过播放器（45）与队列抽屉（46）。
 */
const player = usePlayerStore()
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')

let origin: HTMLElement | null = null
let savedOverflow = ''
let locked = false

function close() {
  player.closeNowPlaying()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && player.nowPlaying) close()
}

watch(
  () => player.nowPlaying,
  async (open) => {
    if (open) {
      // 打开来源就是播放器的封面按钮，关掉时把焦点还给它
      const active = document.activeElement
      origin = active instanceof HTMLElement ? active : null
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      locked = true
      await nextTick()
      closeButton.value?.focus()
      return
    }
    if (locked) {
      document.body.style.overflow = savedOverflow
      locked = false
    }
    if (origin && origin.isConnected) origin.focus()
    origin = null
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (locked) document.body.style.overflow = savedOverflow
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
        <NowPlayingArtwork />
        <NowPlayingSide />
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
    /* 左窄右宽：歌词列 1280px 下约 660px */
    grid-template-columns: minmax(0, 42fr) minmax(0, 58fr);
    align-items: stretch;
    gap: clamp(var(--space-6), 5vw, var(--space-8));
    padding: clamp(var(--space-5), 4vw, var(--space-8));
    background: var(--scrim-strong);
    backdrop-filter: blur(24px);
    overflow: hidden;
  }
  .np-close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 1;
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
    /* 竖排：封面在上、歌词在下方剩余高度里滚动 */
    .now-playing {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
      align-items: stretch;
      gap: var(--space-3);
      padding: var(--space-6) var(--space-4) var(--space-4);
    }
    .np-close {
      top: var(--space-2);
      right: var(--space-2);
    }
  }
}
</style>
