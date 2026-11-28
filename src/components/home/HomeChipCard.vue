<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import PlayingBadge from './PlayingBadge.vue'
import { usePlayerStore } from '@/stores/player'
import type { Entity } from '@/types/catalog'
import { computed } from 'vue'

/** 紧凑 chip 卡（随机漫游）：44px 小封面 + 曲名/艺人两行；点击整张卡播放 */
const props = defineProps<{ song: Entity }>()
const emit = defineEmits<{ play: [] }>()

const player = usePlayerStore()
/** 正在播放：比 player.song.id */
const isPlaying = computed(() => player.song?.id === props.song.id)

function artistsOf(song: Entity) {
  const artists = song.artists
  if (!artists || artists.length === 0) return '未填写歌手'
  return artists.map((artist) => artist.name).join(' / ')
}
</script>

<template>
  <button
    :aria-current="isPlaying ? 'true' : undefined"
    :aria-label="(isPlaying ? '正在播放 ' : '播放 ') + song.name"
    :class="['home-chip', { 'is-playing': isPlaying }]"
    type="button"
    @click="emit('play')"
  >
    <span class="chip-art">
      <EntityCover class="chip-cover" :item="song" />
      <PlayingBadge v-if="isPlaying" class="chip-playing" />
    </span>
    <span class="chip-text">
      <strong>{{ song.name }}</strong>
      <small>{{ artistsOf(song) }}</small>
    </span>
  </button>
</template>

<style scoped>
@layer components {
  .home-chip {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    /* 224×4 + 12×3 = 932 ≤ 944（1280 下内容宽）：一行正好 4 个，不被切 */
    flex: 0 0 224px;
    width: 224px;
    height: 64px;
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: var(--shadow-cover);
    text-align: left;
    scroll-snap-align: start;
    transition:
      transform var(--transition-fast),
      box-shadow var(--transition-fast),
      border-color var(--transition-fast);
  }
  .home-chip:hover {
    transform: translateY(-2px);
    border-color: var(--brand-line-strong);
    box-shadow: var(--shadow-md);
  }
  .home-chip:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  /* 正在播放：小封面外圈 2px 品牌描边 + 左下角均衡器 */
  .home-chip.is-playing .chip-art {
    box-shadow: 0 0 0 2px var(--brand);
  }
  .chip-art {
    position: relative;
    flex-shrink: 0;
    width: 44px;
    border-radius: var(--radius-sm);
  }
  .chip-art > .chip-cover {
    width: 100%;
    border-radius: inherit;
  }
  .chip-playing {
    position: absolute;
    bottom: -4px;
    left: -4px;
    z-index: 1;
  }
  .chip-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .chip-text strong {
    overflow: hidden;
    color: var(--text);
    font-size: var(--font-base);
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .chip-text small {
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  @media (prefers-reduced-motion: reduce) {
    .home-chip:hover {
      transform: none;
    }
  }
  @media (max-width: 899px) {
    .home-chip {
      flex-basis: 100%;
      width: 100%;
    }
  }
}
</style>
