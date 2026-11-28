<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'

/** 播放器中间那组键：上一首 / 播放暂停 / 下一首。 */
const player = usePlayerStore()
const queue = useQueueStore()
</script>

<template>
  <div class="player-controls">
    <IconButton label="上一首" :disabled="!queue.length" title="上一首" @click="player.previous()">
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="M7 5v14M19 5l-9 7 9 7Z" /></svg></IconButton
    ><button
      :aria-busy="player.loading"
      :aria-label="player.playing ? '暂停' : '播放'"
      :title="player.playing ? '暂停' : '播放'"
      class="play-button"
      @click="player.toggle()"
    >
      <svg aria-hidden="true" class="ui-icon playback-icon" viewBox="0 0 24 24">
        <path :d="player.playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'm8 5 11 7-11 7Z'" />
      </svg></button
    ><IconButton label="下一首" :disabled="!queue.length" title="下一首" @click="player.next()">
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="M17 5v14M5 5l9 7-9 7Z" />
      </svg>
    </IconButton>
  </div>
</template>

<style scoped>
@layer components {
  .player-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .player-controls .icon-button {
    color: var(--text-muted);
  }
  .play-button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    color: var(--on-brand);
    background: var(--brand);
  }
  .play-button[aria-busy='true'] {
    opacity: 0.6;
  }
  @media (max-width: 540px) {
    .player-controls .icon-button {
      display: none;
    }
  }
}
</style>
