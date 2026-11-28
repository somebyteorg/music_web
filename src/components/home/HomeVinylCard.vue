<script lang="ts" setup>
import { usePlayerStore } from '@/stores/player'
import type { Entity } from '@/types/catalog'
import { computed } from 'vue'

/**
 * 黑胶盘卡（常听专辑）：圆形唱片 + 中心 8px 圆孔，hover 时 8s 线性旋转。
 * 旋转是 animation，prefers-reduced-motion 时由 @layer a11y 的 animation:none 统一关掉（保留静态层次）。
 */
const props = defineProps<{ album: Entity }>()

const player = usePlayerStore()
/** 正在播放：player.song.albums 里含这张专辑 */
const isPlaying = computed(() => {
  const albums = player.song?.albums
  if (!albums) return false
  return albums.some((album) => album.id === props.album.id)
})

function artistsOf(album: Entity) {
  const artists = album.artists
  if (!artists || artists.length === 0) return '未知歌手'
  return artists.map((artist) => artist.name).join(' / ')
}
</script>

<template>
  <RouterLink
    :aria-current="isPlaying ? 'true' : undefined"
    :aria-label="'打开专辑 ' + album.name"
    :class="['vinyl-card', { 'is-playing': isPlaying }]"
    :to="'/albums/' + album.id"
  >
    <span class="vinyl-art">
      <span aria-hidden="true" class="vinyl-disc"></span>
    </span>
    <span class="vinyl-name">{{ album.name }}</span>
    <span class="vinyl-meta">{{ artistsOf(album) }}</span>
  </RouterLink>
</template>

<style scoped>
@layer components {
  .vinyl-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    flex: 0 0 148px;
    width: 148px;
    padding: var(--space-1);
    border-radius: var(--radius-lg);
    text-align: center;
    scroll-snap-align: start;
    transition: transform var(--transition-fast);
  }
  .vinyl-card:hover {
    transform: translateY(-2px);
  }
  .vinyl-card:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  /* 正在播放：只让专辑名转品牌色（与 SongRow.playing 一致），不加描边/徽标 */
  .vinyl-card.is-playing .vinyl-name {
    color: var(--brand-strong);
  }
  .vinyl-art {
    position: relative;
    display: grid;
    place-items: center;
  }
  /* 唱片本体：外圈刻纹（radial 渐变）+ 中心 8px 圆孔（透明，露出底色） */
  .vinyl-disc {
    display: block;
    width: 148px;
    height: 148px;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, var(--surface) 0 4px, transparent 4px),
      repeating-radial-gradient(
        circle at center,
        var(--ink) 0 3px,
        color-mix(in srgb, var(--ink) 90%, var(--brand)) 3px 6px
      );
    box-shadow: var(--shadow-md);
    transition: box-shadow var(--transition-fast);
  }
  .vinyl-card:hover .vinyl-disc {
    animation: vinyl-spin 8s linear infinite;
    box-shadow: var(--shadow-lg);
  }
  @keyframes vinyl-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .vinyl-name {
    max-width: 100%;
    overflow: hidden;
    color: var(--text);
    font-size: var(--font-base);
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .vinyl-meta {
    max-width: 100%;
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* reduce：不转、不位移（阴影提升保留，层次还在） */
  @media (prefers-reduced-motion: reduce) {
    .vinyl-card:hover {
      transform: none;
    }
    .vinyl-card:hover .vinyl-disc {
      animation: none;
    }
  }
  @media (max-width: 899px) {
    .vinyl-card {
      flex-basis: 120px;
      width: 120px;
    }
    .vinyl-disc {
      width: 120px;
      height: 120px;
    }
  }
}
</style>
