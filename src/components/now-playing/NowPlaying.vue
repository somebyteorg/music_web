<script lang="ts" setup>
import { useMediaQuery } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useNowPlayingLyrics } from '@/composables/useNowPlayingLyrics'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'
import NowPlayingArtwork from './NowPlayingArtwork.vue'
import NowPlayingBackdrop from './NowPlayingBackdrop.vue'
import NowPlayingEmpty from './NowPlayingEmpty.vue'
import NowPlayingHeader from './NowPlayingHeader.vue'
import NowPlayingSide from './NowPlayingSide.vue'
import { provideNowPlayingLyrics } from './lyricsContext'

/**
 * 全屏「沉浸歌词页」外壳：开关、焦点、锁滚动、Esc、卡片编排，以及歌词状态的所有者。
 * 卡片（.np-stage）是居中的一块定高玻璃卡：背景是模糊封面 + 主题遮罩（NowPlayingBackdrop），
 * 卡内第一行是头部（专辑·歌手 + 歌词/队列 tab），下面是左栏（封面/信息/控制）与右栏（歌词/队列）。
 * 歌词状态在这里取一次，通过 provide 给右栏与卡片级空态共用，避免重复取词。
 * z-index 60：压过播放器（45）与队列抽屉（46）。
 */
const player = usePlayerStore()
const { totalLength } = usePlayerMeta()
const lyrics = useNowPlayingLyrics()
provideNowPlayingLyrics(lyrics)

const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const compact = useMediaQuery('(max-width: 899px)')
const tab = ref<'lyrics' | 'queue'>('lyrics')

/** 移动端歌词态；桌面永远算"已展开" */
const lyricsOpen = computed(() => !compact.value || player.nowPlayingLyrics)
/** 头部行（专辑·歌手 + tab）：桌面恒有，移动端只在歌词态出现 */
const showHeader = computed(() => !compact.value || player.nowPlayingLyrics)
/** 空态顶掉整张卡片的内容：只在看着歌词、且确实没有歌词时 */
const showEmpty = computed(
  () => lyricsOpen.value && tab.value === 'lyrics' && lyrics.status.value === 'empty',
)

/** 卡片顶部进度线的宽度（纯展示，不交互） */
const progressWidth = computed(() => {
  const total = totalLength.value
  if (!total) return '0%'
  const ratio = Math.min(1, player.time / total)
  return `${(ratio * 100).toFixed(2)}%`
})

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
        <NowPlayingBackdrop />
        <div :class="['np-stage', { 'is-lyrics': lyricsOpen, 'is-empty': showEmpty }]">
          <div aria-hidden="true" class="np-progress-line">
            <span :style="{ width: progressWidth }"></span>
          </div>
          <button
            ref="closeButton"
            aria-label="关闭歌词预览"
            class="icon-button large np-close"
            title="关闭"
            type="button"
            @click="close"
          >
            <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
          <NowPlayingHeader v-if="showHeader" v-model:tab="tab" class="np-header-slot" />
          <NowPlayingArtwork class="np-left-slot" />
          <Transition name="np-side">
            <!-- 空态只接管右侧面板：左栏（封面 / 信息 / 控制 / 进度）必须一直在，沉浸页里照样能控播放 -->
            <NowPlayingEmpty v-if="showEmpty" class="np-side-slot" />
            <NowPlayingSide v-else-if="lyricsOpen" :tab="tab" class="np-side-slot" />
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
    /* 单列铺满 + 居中：卡片宽度按可视宽度算（place-content: center 会让轨道缩成内容宽度，
       空态时卡片会突然变窄） */
    grid-template-columns: minmax(0, 1fr);
    place-items: center;
    /* 卡片高度：桌面 min(78vh, 720px)，移动端整屏减去上下留白（见媒体查询） */
    --np-stage-height: min(78vh, 720px);
    overflow: hidden;
  }
  /* 玻璃卡片：半透明面板 + 大圆角 + 大模糊，背景的模糊封面透上来 */
  .np-stage {
    position: relative;
    z-index: 1;
    display: grid;
    /* 左窄右宽：歌词列 1280×800 下约 630px */
    grid-template-columns: minmax(0, 42fr) minmax(0, 58fr);
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--space-4) var(--space-8);
    width: min(1180px, calc(100% - 2 * var(--space-8)));
    height: var(--np-stage-height);
    margin: auto;
    padding: var(--space-6);
    background: color-mix(in srgb, var(--surface) 58%, transparent);
    border: 1px solid var(--line);
    border-radius: 24px;
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(40px);
  }
  .np-header-slot {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .np-left-slot {
    grid-column: 1;
    grid-row: 2;
  }
  .np-side-slot {
    grid-column: 2;
    grid-row: 2;
  }
  /* 卡片顶部进度线：2px，前景品牌色、底轨 --line，纯展示 */
  .np-progress-line {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 2px;
    overflow: hidden;
    border-radius: 24px 24px 0 0;
    background: var(--line);
  }
  .np-progress-line > span {
    display: block;
    height: 100%;
    background: var(--brand);
    transition: width var(--transition-base) linear;
  }
  .np-close {
    position: absolute;
    top: var(--space-4);
    right: var(--space-4);
    z-index: 2;
  }
  /* 热区 44×44（.icon-button.large），图标本体保持 18px */
  .np-close .ui-icon {
    width: 18px;
    height: 18px;
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
    /* 竖排：封面态整张卡片只有左栏；歌词态是「头部行 + 小封面信息行 + 歌词」 */
    .np-stage {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      gap: var(--space-3);
      width: 100%;
      padding: var(--space-4);
      border-radius: var(--radius-xl);
    }
    .np-left-slot {
      grid-column: 1;
      grid-row: 1;
    }
    /* 离开歌词态时右栏还在淡出：它必须落回同一个格子，
       否则会在单列舞台里生出隐式第二列/第二行，把左栏挤成 0 宽 */
    .np-side-slot {
      grid-column: 1;
      grid-row: 1;
    }
    .np-stage.is-lyrics {
      grid-template-rows: auto auto minmax(0, 1fr);
    }
    .np-stage.is-lyrics .np-header-slot {
      grid-column: 1;
      grid-row: 1;
    }
    .np-stage.is-lyrics .np-left-slot {
      grid-row: 2;
    }
    .np-stage.is-lyrics .np-side-slot {
      grid-column: 1;
      grid-row: 3;
    }
  }
}
</style>
