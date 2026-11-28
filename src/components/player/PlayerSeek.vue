<script lang="ts" setup>
import { computed } from 'vue'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'
import { duration } from '@/utils/format'

/**
 * 进度条：时间 / 进度 / 总时长 / 音量。播放器外框与全屏歌词页共用。
 * 播放器里收起时整段被压扁并淡出（max-width: 0 + opacity: 0）；收起态只属于外框，
 * 所以 variant="stage" 不再把 collapsed 当成隐藏依据。
 */
const props = withDefaults(defineProps<{ variant?: 'bar' | 'stage' }>(), { variant: 'bar' })

const player = usePlayerStore()
const { totalLength } = usePlayerMeta()

/** 收起态只在外框里让位，全屏页即使播放器是收起打开的也要能操作 */
const hidden = computed(() => props.variant === 'bar' && player.collapsed)
</script>

<template>
  <div :class="['player-mid', { 'is-stage': variant === 'stage' }]">
    <span class="time" :aria-hidden="hidden">{{ duration(player.time) }}</span><input
      :aria-hidden="hidden"
      :max="totalLength || 1"
      :tabindex="hidden ? -1 : 0"
      :value="player.time"
      aria-label="播放进度"
      class="seek"
      min="0"
      step="0.1"
      type="range"
      @input="player.seek(Number(($event.target as HTMLInputElement).value))"
    /><span class="time" :aria-hidden="hidden">{{ duration(totalLength) }}</span
    ><input
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
  /* 全屏页：不再参与外框的弹性分配，宽度对齐上面那一列 420px */
  .player-mid.is-stage {
    flex: none;
    width: min(420px, 100%);
    gap: var(--space-3);
  }
  .player-mid.is-stage .volume {
    width: 120px;
  }
  .player-mid.is-stage .time {
    max-width: none;
    font-size: var(--font-xs);
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
