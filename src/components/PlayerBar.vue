<script lang="ts" setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playModeLabels, useQueueStore } from '@/stores/queue'
import { duration, qualities } from '@/utils/format'
import EntityCover from './EntityCover.vue'
import PlayModeIcon from './PlayModeIcon.vue'
import ScrollingTitle from './ScrollingTitle.vue'
import QueuePanel from './QueuePanel.vue'

const player = usePlayerStore()
const queue = useQueueStore()

const visible = computed(() => player.available || !!queue.current)
const displayItem = computed(() => {
  if (player.song) return player.song
  const entry = queue.current
  return entry
    ? { id: entry.songId, name: entry.name, cover_id: entry.coverId, image_url: entry.imageUrl }
    : undefined
})
const totalLength = computed(() => player.length || queue.current?.duration || 0)
const subtitle = computed(() => {
  if (player.file) return `${qualities[player.file.quality]} · ${player.file.codec.toUpperCase()}`
  return queue.current ? '已暂停' : ''
})
function closeAll() {
  player.close()
  queue.clear()
}
const modeLabel = computed(() => playModeLabels[queue.mode])
</script>

<template>
  <aside
    v-if="visible"
    :class="['player', { collapsed: player.collapsed }]"
    aria-label="试听播放器"
  >
    <EntityCover :item="displayItem" />
    <div class="player-title">
      <ScrollingTitle :text="displayItem?.name" /><span>{{ subtitle }}</span>
    </div>
    <div class="player-controls">
      <button
        :disabled="!queue.length"
        aria-label="上一首"
        class="icon-button"
        title="上一首"
        @click="player.previous()"
      >
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path d="M7 5v14M19 5l-9 7 9 7Z" />
        </svg></button
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
      ><button
        :disabled="!queue.length"
        aria-label="下一首"
        class="icon-button"
        title="下一首"
        @click="player.next()"
      >
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path d="M17 5v14M5 5l9 7-9 7Z" />
        </svg>
      </button>
    </div>
    <template v-if="!player.collapsed"
      ><span class="time">{{ duration(player.time) }}</span
      ><input
        :max="totalLength || 1"
        :value="player.time"
        aria-label="播放进度"
        class="seek"
        min="0"
        step="0.1"
        type="range"
        @input="player.seek(Number(($event.target as HTMLInputElement).value))" /><span
        class="time"
        >{{ duration(totalLength) }}</span
      ><input
        :value="player.volume"
        aria-label="音量"
        class="volume"
        max="1"
        min="0"
        step=".01"
        type="range"
        @input="player.setVolume(Number(($event.target as HTMLInputElement).value))"
    /></template>
    <div class="player-extra">
      <button
        :aria-label="modeLabel"
        :title="modeLabel"
        class="icon-button mode-button"
        @click="queue.cycleMode()"
      >
        <PlayModeIcon :mode="queue.mode" />
      </button>
      <button
        :aria-expanded="queue.open"
        aria-controls="queue-panel"
        :aria-label="`播放队列，共 ${queue.length} 首`"
        :title="`播放队列（${queue.length}）`"
        class="icon-button queue-button"
        @click="queue.open = !queue.open"
      >
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path d="M4 6h11M4 11h11M4 16h7M17 10l4 3-4 3Z" />
        </svg>
        <span v-if="queue.length" class="queue-count">{{
          queue.length > 99 ? '99+' : queue.length
        }}</span>
      </button>
      <button
        :aria-expanded="!player.collapsed"
        :aria-label="player.collapsed ? '展开播放器' : '收起播放器'"
        :title="player.collapsed ? '展开播放器' : '收起播放器'"
        class="icon-button"
        @click="player.collapsed = !player.collapsed"
      >
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path :d="player.collapsed ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'" />
        </svg>
      </button>
      <button aria-label="关闭播放器" class="icon-button" title="关闭播放器" @click="closeAll">
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path d="m6 6 12 12M6 18 18 6" />
        </svg>
      </button>
    </div>
  </aside>
  <QueuePanel />
</template>

<style scoped>
.player {
  position: fixed;
  z-index: 45;
  left: calc(var(--sidebar-width) + 20px);
  right: 20px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 76px;
  padding: 14px 20px;
  background: #fffffff5;
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 8px 40px #29203514;
  backdrop-filter: blur(20px);
}
.player > .cover {
  width: 46px;
  flex-shrink: 0;
}
.player-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 168px;
  min-width: 0;
}
.player-title strong {
  font-size: var(--font-md);
}
.player-title span {
  font-size: var(--font-xs);
  color: var(--muted);
}
.player-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.player-controls .icon-button {
  color: var(--muted);
}
.play-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  color: #fff;
  background: var(--purple);
}
.play-button[aria-busy='true'] {
  opacity: 0.6;
}
.seek {
  flex: 1;
  min-width: 60px;
  accent-color: var(--purple);
}
.volume {
  width: 75px;
  accent-color: var(--purple);
}
.time {
  color: var(--muted);
  font-size: var(--font-xs);
  font-variant-numeric: tabular-nums;
}
.player-extra {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.player-extra .icon-button {
  color: var(--muted);
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
  border-radius: var(--radius-md);
  background: var(--purple);
  color: #fff;
  font-size: 9px;
  line-height: 15px;
  font-variant-numeric: tabular-nums;
}
.player.collapsed {
  left: auto;
  right: 12px;
  bottom: 12px;
  width: min(420px, calc(100% - 24px));
  padding: 8px 12px;
  min-height: 54px;
  gap: 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 16px #28233512;
}
.collapsed .player-title {
  flex: 1;
  width: auto;
}
.collapsed .player-controls {
  flex-shrink: 0;
}
@media (max-width: 980px) {
  .mode-button {
    display: none;
  }
}
@media (max-width: 760px) {
  .player {
    left: 16px;
    right: 16px;
    padding-inline: 14px;
  }
  .player-title {
    width: 120px;
  }
  .volume {
    display: none;
  }
}
@media (max-width: 540px) {
  .player {
    left: 10px;
    right: 10px;
    bottom: 10px;
    flex-wrap: wrap;
    gap: 7px;
  }
  .player-title {
    flex: 1;
    width: 100px;
  }
  .seek {
    order: 5;
    flex-basis: 100%;
    margin: 0;
  }
  .time {
    display: none;
  }
  .player-controls .icon-button {
    display: none;
  }
}
</style>
