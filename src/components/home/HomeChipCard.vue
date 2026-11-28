<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import type { Entity } from '@/types/catalog'

/** 紧凑 chip 卡（随机漫游）：44px 小封面 + 曲名/艺人两行；点击整张卡播放 */
defineProps<{ song: Entity }>()
const emit = defineEmits<{ play: [] }>()

function artistsOf(song: Entity) {
  const artists = song.artists
  if (!artists || artists.length === 0) return '未填写歌手'
  return artists.map((artist) => artist.name).join(' / ')
}
</script>

<template>
  <button :aria-label="'播放 ' + song.name" class="home-chip" type="button" @click="emit('play')">
    <EntityCover class="chip-cover" :item="song" />
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
    flex: 0 0 264px;
    width: 264px;
    height: 64px;
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
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
    box-shadow: var(--shadow-sm);
  }
  .home-chip:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  .home-chip > .chip-cover {
    flex-shrink: 0;
    width: 44px;
    border-radius: var(--radius-sm);
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
    font-weight: 550;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .chip-text small {
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-xs);
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
