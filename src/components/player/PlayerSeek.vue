<script lang="ts" setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'
import { duration } from '@/utils/format'

/**
 * 播放器中段的进度条：时间 / 进度 / 总时长 / 音量。
 * 收起时整段被压扁并淡出（max-width: 0 + opacity: 0），不是突然消失。
 */
const player = usePlayerStore()
const queue = useQueueStore()

const totalLength = computed(() => player.length || queue.current?.duration || 0)
</script>

<template>
  <div class="player-mid">
    <span class="time" :aria-hidden="player.collapsed">{{ duration(player.time) }}</span><input
      :aria-hidden="player.collapsed"
      :max="totalLength || 1"
      :tabindex="player.collapsed ? -1 : 0"
      :value="player.time"
      aria-label="播放进度"
      class="seek"
      min="0"
      step="0.1"
      type="range"
      @input="player.seek(Number(($event.target as HTMLInputElement).value))"
    /><span class="time" :aria-hidden="player.collapsed">{{ duration(totalLength) }}</span
    ><input
      :aria-hidden="player.collapsed"
      :tabindex="player.collapsed ? -1 : 0"
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
  @media (max-width: 760px) {
    .volume {
      display: none;
    }
  }
  @media (max-width: 540px) {
    /* 窄屏把「时间 / 进度 / 音量」整段放到第二行（原来是对 .seek 单独设置，包裹后改为整段） */
    .player-mid {
      order: 5;
      flex-basis: 100%;
      gap: 7px;
    }
    .seek {
      margin: 0;
    }
    .time {
      display: none;
    }
  }
}
</style>
