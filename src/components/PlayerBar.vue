<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playModeLabels, useQueueStore } from '@/stores/queue'
import { duration, qualities } from '@/utils/format'
import EntityCover from './EntityCover.vue'
import PlayModeIcon from './PlayModeIcon.vue'
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
      <strong>{{ displayItem?.name }}</strong><span>{{ subtitle }}</span>
    </div>
    <div class="player-controls">
      <IconButton
        label="上一首"
        :disabled="!queue.length"
        title="上一首"
        @click="player.previous()"
      >
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
    <template
      ><span class="time" :aria-hidden="player.collapsed">{{ duration(player.time) }}</span
      ><input
        :aria-hidden="player.collapsed"
        :max="totalLength || 1"
        :tabindex="player.collapsed ? -1 : 0"
        :value="player.time"
        aria-label="播放进度"
        class="seek"
        min="0"
        step="0.1"
        type="range"
        @input="player.seek(Number(($event.target as HTMLInputElement).value))" /><span
        class="time"
        :aria-hidden="player.collapsed"
        >{{ duration(totalLength) }}</span
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
    /></template>
    <div class="player-extra">
      <IconButton
        :label="modeLabel"
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
  </aside>
  <QueuePanel />
</template>

<style scoped>
@layer components {
  .player {
    position: fixed;
    z-index: 45;
    left: calc(var(--sidebar-width) + 20px);
    right: 20px;
    bottom: var(--player-offset);
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: var(--player-height);
    padding: 14px 20px;
    background: var(--surface-glass-strong);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: var(--shadow-player);
    backdrop-filter: blur(20px);
    /* 收起/展开全程只动可插值的长度属性（不再出现 left: auto / width: 撑开） */
    transition:
      left var(--motion-morph),
      right var(--motion-morph),
      bottom var(--motion-morph),
      padding var(--motion-morph),
      min-height var(--motion-morph),
      gap var(--motion-morph),
      border-radius var(--motion-morph),
      box-shadow var(--motion-morph);
  }
  .player > .cover {
    width: 46px;
    flex-shrink: 0;
    transition: width var(--motion-morph);
  }
  .player-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 168px;
    min-width: 0;
  }
  .player-title strong {
    font-size: 14px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .player-title span {
    font-size: 11px;
    color: var(--text-muted);
  }
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
  .seek {
    flex: 1;
    min-width: 60px;
    max-width: 100%;
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
  .collapse-icon {
    transition: transform var(--motion-morph);
  }
  .collapse-icon.flipped {
    transform: rotate(180deg);
  }
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
  .player.collapsed {
    /* 用长度代替 left:auto + width，浏览器才能在两端之间插值 */
    left: calc(100% - 432px);
    right: 12px;
    bottom: 12px;
    padding: 8px 12px;
    min-height: 54px;
    gap: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow-player-collapsed);
  }
  /* 收起时进度/时间/音量不是"消失"，而是被压扁并淡出 */
  .collapsed .seek,
  .collapsed .volume,
  .collapsed .time {
    max-width: 0;
    min-width: 0;
    padding-inline: 0;
    border-width: 0;
    opacity: 0;
    pointer-events: none;
  }
  .collapsed .seek {
    flex-basis: 0;
  }
  .collapsed .player > .cover {
    width: 38px;
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
    /* 窄屏下小窗贴满左右 12px（与桌面 420px 宽等效的视觉密度） */
    .player.collapsed {
      left: 12px;
      right: 12px;
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
    /* 收起后回到单行小窗（进度条那行的 flex-basis 归零，随之收高） */
    .player.collapsed {
      flex-wrap: nowrap;
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
}
</style>
