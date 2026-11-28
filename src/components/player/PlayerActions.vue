<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import PlayModeIcon from '@/components/PlayModeIcon.vue'
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playModeLabels, useQueueStore } from '@/stores/queue'

/** 播放器右端：循环模式 / 队列 / 收起展开 / 关闭。 */
const player = usePlayerStore()
const queue = useQueueStore()

const modeLabel = computed(() => playModeLabels[queue.mode])

function closeAll() {
  player.close()
  queue.clear()
}
</script>

<template>
  <div class="player-extra">
    <IconButton
      :label="modeLabel"
      :aria-hidden="player.collapsed"
      :tabindex="player.collapsed ? -1 : 0"
      :title="modeLabel"
      @click="queue.cycleMode()"
      class="mode-button"
    >
      <PlayModeIcon :mode="queue.mode" />
    </IconButton>
    <IconButton
      :label="`播放队列，共 ${queue.length} 首`"
      :aria-expanded="queue.open"
      aria-controls="queue-panel"
      :title="`播放队列（${queue.length}）`"
      @click="queue.open = !queue.open"
      class="queue-button"
    >
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="M4 6h11M4 11h11M4 16h7M17 10l4 3-4 3Z" />
      </svg>
      <span v-if="queue.length" class="queue-count">{{
        queue.length > 99 ? '99+' : queue.length
      }}</span>
    </IconButton>
    <IconButton
      :label="player.collapsed ? '展开播放器' : '收起播放器'"
      :aria-expanded="!player.collapsed"
      :title="player.collapsed ? '展开播放器' : '收起播放器'"
      @click="player.collapsed = !player.collapsed"
    >
      <svg
        aria-hidden="true"
        :class="['ui-icon', 'collapse-icon', { flipped: player.collapsed }]"
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </IconButton>
    <IconButton label="关闭播放器" title="关闭播放器" @click="closeAll">
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="m6 6 12 12M6 18 18 6" />
      </svg>
    </IconButton>
  </div>
</template>

<style scoped>
@layer components {
  .player-extra {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .player-extra .icon-button {
    color: var(--text-muted);
  }
  .queue-button {
    position: relative;
  }
  .queue-count {
    position: absolute;
    top: -2px;
    right: -4px;
    min-width: 15px;
    padding: 0 3px;
    border-radius: 8px;
    background: var(--brand);
    color: var(--on-brand);
    font-size: 9px;
    line-height: 15px;
    font-variant-numeric: tabular-nums;
  }
  .collapse-icon {
    transition: transform var(--motion-morph);
  }
  .collapse-icon.flipped {
    transform: rotate(180deg);
  }
  .mode-button {
    transition:
      width var(--motion-morph),
      min-width var(--motion-morph),
      opacity var(--motion-morph);
  }
  /* 收起时让出「循环模式」这 32px 给标题（宽度与透明度一起过渡，避免突然消失） */
  :global(.player.collapsed .mode-button) {
    width: 0;
    min-width: 0;
    padding-inline: 0;
    border-width: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }
  @media (max-width: 980px) {
    .mode-button {
      display: none;
    }
  }
}
</style>
