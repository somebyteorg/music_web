<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import PlayerModeButton from './PlayerModeButton.vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'

/** 播放器右端：循环模式 / 队列 / 收起展开 / 关闭。循环按钮本体在 PlayerModeButton（全屏页共用）。 */
const player = usePlayerStore()
const queue = useQueueStore()

function closeAll() {
  player.close()
  queue.clear()
}
</script>

<template>
  <div class="player-extra">
    <PlayerModeButton />
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
}
</style>
