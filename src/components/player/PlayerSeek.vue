<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'
import { duration } from '@/utils/format'

/**
 * 进度区。播放器外框（variant="bar"）：时间 / 进度 / 总时长 / 音量，收起时整段压扁淡出。
 * 沉浸页（variant="stage"）：只有「时间 – 进度 – 时间」，进度条换成自定义外观（4px 轨道 + 12px 拇指），
 * 音量条不在沉浸页出现。
 * 拖动期间用本地值渲染，避免 timeupdate 把滑块拽回去；松手（pointerup / change）后对齐回 player.time。
 */
const props = withDefaults(defineProps<{ variant?: 'bar' | 'stage' }>(), { variant: 'bar' })

const player = usePlayerStore()
const { totalLength } = usePlayerMeta()

/** 收起态只在外框里让位，全屏页即使播放器是收起打开的也要能操作 */
const hidden = computed(() => props.variant === 'bar' && player.collapsed)

/** 拖动中冻结外部时间的写入 */
const dragging = ref(false)
const localTime = ref(0)

/** 已播放比例：给自定义轨道做双色渐变 */
const fill = computed(() => {
  const total = totalLength.value
  const time = dragging.value ? localTime.value : player.time
  if (!total) return '0%'
  return `${(Math.min(1, time / total) * 100).toFixed(2)}%`
})

const seekStyle = computed<CSSProperties>(() => ({ '--fill': fill.value }))

/** 拖动中只认本地值，其余时间跟随播放进度 */
const seekValue = computed(() => (dragging.value ? localTime.value : player.time))

function onSeekInput(value: string) {
  const next = Number(value)
  if (dragging.value) localTime.value = next
  player.seek(next)
}

function startDrag() {
  localTime.value = player.time
  dragging.value = true
}

function endDrag() {
  if (!dragging.value) return
  dragging.value = false
  localTime.value = player.time
}
</script>

<template>
  <div :class="['player-mid', { 'is-stage': variant === 'stage' }]">
    <span class="time" :aria-hidden="hidden">{{ duration(player.time) }}</span><input
      :aria-hidden="hidden"
      :max="totalLength || 1"
      :style="seekStyle"
      :tabindex="hidden ? -1 : 0"
      :value="seekValue"
      aria-label="播放进度"
      class="seek"
      min="0"
      step="0.1"
      type="range"
      @change="endDrag"
      @input="onSeekInput(($event.target as HTMLInputElement).value)"
      @pointerdown="startDrag"
      @pointerup="endDrag"
    /><span class="time" :aria-hidden="hidden">{{ duration(totalLength) }}</span
    ><input
      v-if="variant === 'bar'"
      :aria-hidden="hidden"
      :tabindex="hidden ? -1 : 0"
      :value="player.volume"
      aria-label="音量"
      class="volume"
      max="1"
      min="0"
      step=".01"
      type="range"
      @input="player.setVolume(Number(($event.target as HTMLInputElement).value))"
    />
  </div>
</template>

<style scoped>
@layer components {
  .player-mid {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
    min-width: 0;
    max-width: 100%;
    transition:
      max-width var(--motion-morph),
      opacity var(--motion-morph);
  }
  .seek {
    flex: 1;
    min-width: 60px;
    accent-color: var(--brand);
    transition:
      max-width var(--motion-morph),
      opacity var(--motion-morph);
  }
  .volume {
    width: 75px;
    accent-color: var(--brand);
    transition:
      max-width var(--motion-morph),
      opacity var(--motion-morph);
  }
  .time {
    color: var(--text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    max-width: 72px;
    overflow: hidden;
    white-space: nowrap;
    transition:
      max-width var(--motion-morph),
      opacity var(--motion-morph);
  }
  /* 中段作为整体收放：收起时只让出 1 个间距，而不是 4 个 */
  :global(.player.collapsed .player-mid) {
    flex: 0 1 0;
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }
  /* 沉浸页：不再参与外框的弹性分配，宽度对齐上面那一列 420px */
  .player-mid.is-stage {
    flex: none;
    width: min(420px, 100%);
    gap: var(--space-3);
  }
  .player-mid.is-stage .time {
    max-width: none;
    font-size: var(--font-sm);
  }
  /* 沉浸页的自定义进度条：28px 热区（12px 透明 padding + 4px 轨道），拇指 12px */
  .player-mid.is-stage .seek {
    appearance: none;
    height: 28px;
    min-height: 28px;
    padding-block: 12px;
    background: transparent;
    cursor: pointer;
  }
  .player-mid.is-stage .seek::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(
      to right,
      var(--brand) 0 var(--fill, 0%),
      var(--line) var(--fill, 0%) 100%
    );
  }
  .player-mid.is-stage .seek::-webkit-slider-thumb {
    box-sizing: border-box;
    width: 12px;
    height: 12px;
    /* (4 - 12) / 2：让 12px 拇指垂直居中在 4px 轨道上 */
    margin-top: -4px;
    border: 2px solid var(--brand);
    border-radius: 50%;
    background: var(--surface);
    appearance: none;
    transition: transform var(--motion-morph);
  }
  .player-mid.is-stage .seek:hover::-webkit-slider-thumb,
  .player-mid.is-stage .seek:active::-webkit-slider-thumb {
    transform: scale(1.3333);
  }
  /* Firefox：轨道/已播放段/拇指三件套 */
  .player-mid.is-stage .seek::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--line);
  }
  .player-mid.is-stage .seek::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background: var(--brand);
  }
  .player-mid.is-stage .seek::-moz-range-thumb {
    box-sizing: border-box;
    width: 12px;
    height: 12px;
    border: 2px solid var(--brand);
    border-radius: 50%;
    background: var(--surface);
    transition: transform var(--motion-morph);
  }
  .player-mid.is-stage .seek:hover::-moz-range-thumb,
  .player-mid.is-stage .seek:active::-moz-range-thumb {
    transform: scale(1.3333);
  }
  @media (max-width: 760px) {
    .volume {
      display: none;
    }
  }
  @media (max-width: 540px) {
    /* 窄屏把「时间 / 进度 / 音量」整段放到第二行（只对外框生效，全屏页是纵向排布且要保留时间） */
    .player-mid:not(.is-stage) {
      order: 5;
      flex-basis: 100%;
      gap: 7px;
    }
    .player-mid:not(.is-stage) .seek {
      margin: 0;
    }
    .player-mid:not(.is-stage) .time {
      display: none;
    }
  }
}
</style>
