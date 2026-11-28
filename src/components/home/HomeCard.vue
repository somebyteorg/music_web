<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import type { Entity } from '@/types/catalog'

/**
 * 首页封面卡：cover（猜你喜欢）/ cover-play（最近加入，hover 出播放钮）/ poster（你的收藏，4:5 竖版）。
 * 歌曲卡是原生 <button>，专辑卡是 <RouterLink>；两种共用同一份视觉。
 */
withDefaults(
  defineProps<{
    item: Entity
    /** 副文案：继续听类楼层显示进度，其余显示歌手 */
    hint?: string
    /** 传了就是 RouterLink（专辑卡），不传就是按钮（歌曲卡） */
    to?: string
    /** cover 176 / cover-play 160（hover 播放钮）/ poster 144×180 */
    variant?: 'cover' | 'cover-play' | 'poster'
    /** hover 时中央浮出品牌圆钮（最近加入用） */
    showPlay?: boolean
  }>(),
  { variant: 'cover' },
)
const emit = defineEmits<{ play: [] }>()

function artistsOf(item: Entity) {
  const artists = item.artists
  if (!artists || artists.length === 0) return '未填写歌手'
  return artists.map((artist) => artist.name).join(' / ')
}
</script>

<template>
  <RouterLink
    v-if="to"
    :aria-label="'打开专辑 ' + item.name"
    :class="['home-card', 'home-card--' + variant]"
    :to="to"
  >
    <span class="card-art"><EntityCover :item="item" /></span>
    <span class="card-name">{{ item.name }}</span>
    <span class="card-meta">{{ artistsOf(item) }}</span>
  </RouterLink>
  <button
    v-else
    :aria-label="'播放 ' + item.name"
    :class="['home-card', 'home-card--' + variant]"
    type="button"
    @click="emit('play')"
  >
    <span class="card-art">
      <EntityCover :item="item" />
      <span v-if="showPlay" aria-hidden="true" class="card-play">
        <svg class="ui-icon" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z" /></svg>
      </span>
    </span>
    <span class="card-name">{{ item.name }}</span>
    <span class="card-meta">{{ hint || artistsOf(item) }}</span>
  </button>
</template>

<style scoped>
@layer components {
  .home-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 0 0 176px;
    width: 176px;
    padding: var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-xl);
    background: var(--surface);
    box-shadow: var(--shadow-cover);
    text-align: left;
    scroll-snap-align: start;
    transition:
      transform var(--transition-fast),
      box-shadow var(--transition-fast),
      border-color var(--transition-fast);
  }
  .home-card--cover-play {
    flex-basis: 160px;
    width: 160px;
  }
  .home-card--poster {
    flex-basis: 144px;
    width: 144px;
  }
  .card-art {
    position: relative;
    display: block;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .home-card--poster .card-art {
    aspect-ratio: 4 / 5;
    overflow: hidden;
  }
  .home-card--poster .card-art > .cover {
    height: 100%;
  }
  .card-art > .cover {
    width: 100%;
    border-radius: inherit;
  }
  /* hover 播放钮：默认透明，hover / 键盘聚焦时淡入 */
  .card-play {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: inherit;
    background: color-mix(in srgb, var(--ink) 28%, transparent);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .card-play .ui-icon {
    width: 40px;
    height: 40px;
    padding: 10px;
    border-radius: 50%;
    color: var(--on-brand);
    background: var(--brand);
    box-shadow: var(--shadow-brand);
    fill: currentColor;
    stroke: none;
  }
  .home-card:hover .card-play,
  .home-card:focus-visible .card-play {
    opacity: 1;
  }
  .home-card:hover {
    transform: translateY(-2px);
    border-color: var(--brand-line-strong);
    box-shadow: var(--shadow-md);
  }
  .home-card:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  /* 标题与封面之间留 8（卡片自身 gap 4 + 这里 4） */
  .card-name {
    margin-top: var(--space-1);
    overflow: hidden;
    color: var(--text);
    font-size: var(--font-base);
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .card-meta {
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* reduce：不打位移、播放钮直接出现（静态层次保留） */
  @media (prefers-reduced-motion: reduce) {
    .home-card:hover {
      transform: none;
    }
  }
  @media (max-width: 899px) {
    .home-card,
    .home-card--cover-play {
      flex-basis: 132px;
      width: 132px;
    }
    .home-card--poster {
      flex-basis: 128px;
      width: 128px;
    }
  }
}
</style>
