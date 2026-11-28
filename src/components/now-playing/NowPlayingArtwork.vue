<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'
import { duration } from '@/utils/format'

/**
 * 预览页左栏：大封面 + 曲名/歌手 + 播放组件（上一首 / 播放暂停 / 下一首 + 进度 + 时间 + 音量）。
 * 状态一律从 store 读，和播放器里那几个子组件保持同一套数据源。
 */
const player = usePlayerStore()
const queue = useQueueStore()

const displayItem = computed(() => {
  if (player.song) return player.song
  const entry = queue.current
  return entry
    ? { id: entry.songId, name: entry.name, cover_id: entry.coverId, image_url: entry.imageUrl }
    : undefined
})

const artist = computed(() => {
  const artists = player.song?.artists
  if (artists && artists.length > 0) return artists.map((item) => item.name).join(' / ')
  return queue.current ? queue.current.artists : ''
})

const totalLength = computed(() => player.length || queue.current?.duration || 0)
</script>

<template>
  <div class="np-artwork">
    <EntityCover class="np-cover" :item="displayItem" />
    <div class="np-meta">
      <h2 class="np-title">{{ displayItem?.name }}</h2>
      <p v-if="artist" class="np-artist">{{ artist }}</p>
    </div>
    <div class="np-transport">
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
        class="np-play"
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
    <div class="np-progress">
      <span class="np-time">{{ duration(player.time) }}</span><input
        :max="totalLength || 1"
        :value="player.time"
        aria-label="播放进度"
        class="np-seek"
        min="0"
        step="0.1"
        type="range"
        @input="player.seek(Number(($event.target as HTMLInputElement).value))"
      /><span class="np-time">{{ duration(totalLength) }}</span>
    </div>
    <div class="np-volume">
      <svg aria-hidden="true" class="ui-icon np-volume-icon" viewBox="0 0 24 24">
        <path d="M4 9v6h4l5 4V5L8 9Z" />
      </svg>
      <input
        :value="player.volume"
        aria-label="音量"
        class="np-volume-range"
        max="1"
        min="0"
        step=".01"
        type="range"
        @input="player.setVolume(Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .np-artwork {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-5);
    min-width: 0;
    min-height: 0;
  }
  /* EntityCover 的根元素：.np-artwork 是它的祖先，选择器带 1 个类 + scope 属性，
     特异性足够压过 .cover[data-v-cover] 自带的 10px 圆角 */
  .np-artwork .np-cover {
    width: min(420px, 100%, 52vh);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
  }
  .np-meta {
    max-width: min(420px, 100%);
    text-align: center;
  }
  .np-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .np-artist {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }
  .np-transport {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .np-play {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    flex-shrink: 0;
    border-radius: 50%;
    color: var(--on-brand);
    background: var(--brand);
    transition: opacity var(--transition-fast);
  }
  .np-play[aria-busy='true'] {
    opacity: 0.6;
  }
  .np-play .ui-icon {
    width: 22px;
    height: 22px;
  }
  .np-progress {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: min(420px, 100%);
  }
  .np-seek {
    flex: 1;
    min-width: 0;
    accent-color: var(--brand);
  }
  .np-time {
    color: var(--text-muted);
    font-size: var(--font-xs);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .np-volume {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: min(420px, 100%);
  }
  .np-volume-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--text-muted);
  }
  .np-volume-range {
    width: 140px;
    max-width: 100%;
    accent-color: var(--brand);
  }
  @media (max-width: 899px) {
    .np-artwork {
      gap: var(--space-3);
    }
    /* 竖排时封面按屏宽收（60vw，最多 280px），歌词留给下方剩余高度 */
    .np-artwork .np-cover {
      width: min(60vw, 280px);
    }
    .np-title {
      font-size: 18px;
    }
    .np-play {
      width: 46px;
      height: 46px;
    }
  }
}
</style>
