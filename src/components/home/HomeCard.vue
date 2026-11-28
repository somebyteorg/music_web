<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import { usePlayerStore } from '@/stores/player'
import type { Entity } from '@/types/catalog'
import { computed } from 'vue'

/**
 * 首页封面卡：cover（猜你喜欢）/ cover-play（最近加入，hover 出播放钮）/ poster（你的收藏，4:5 竖版）。
 * 歌曲卡是原生 <button>，专辑卡是 <RouterLink>；两种共用同一份视觉。
 */
const props = withDefaults(
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

const player = usePlayerStore()

/** 正在播放：歌曲卡比 player.song.id，专辑卡比 player.song.albums 里是否含这张专辑 */
const isPlaying = computed(() => {
  const item = props.item
  if (props.to) {
    const albums = player.song?.albums
    if (!albums) return false
    return albums.some((album) => album.id === item.id)
  }
  return player.song?.id === item.id
})

function artistsOf(item: Entity) {
  const artists = item.artists
  if (!artists || artists.length === 0) return '未填写歌手'
  return artists.map((artist) => artist.name).join(' / ')
}
</script>

<template>
  <RouterLink
    v-if="to"
    :aria-current="isPlaying ? 'true' : undefined"
    :aria-label="'打开专辑 ' + item.name"
    :class="['home-card', 'home-card--' + variant, { 'is-playing': isPlaying }]"
    :to="to"
  >
    <span class="card-art">
      <EntityCover :item="item" />
    </span>
    <span class="card-name">{{ item.name }}</span>
    <span class="card-meta">{{ artistsOf(item) }}</span>
  </RouterLink>
  <button
    v-else
    :aria-current="isPlaying ? 'true' : undefined"
    :aria-label="(isPlaying ? '正在播放 ' : '播放 ') + item.name"
    :class="['home-card', 'home-card--' + variant, { 'is-playing': isPlaying }]"
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
  /* 与目录网格（catalogGrid.css 的 .grid .entity-main）同一套口径：
     卡片本身不画框，封面自己带圆角与阴影，hover 时封面浮起 */
  .home-card {
    display: flex;
    flex-direction: column;
    flex: 0 0 176px;
    width: 176px;
    text-align: left;
    scroll-snap-align: start;
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
    /* 10px 与 EntityCover 的 .cover 圆角一致（那里也是字面量），
       否则外框阴影会被裁成另一个形状 */
    margin-bottom: var(--space-4);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: var(--shadow-cover);
    transition:
      transform 0.25s,
      box-shadow 0.25s;
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
  }
  /* 正在播放：只让曲名转品牌色，与 SongRow.playing 的写法一致，不加描边/徽标 */
  .home-card.is-playing .card-name {
    color: var(--brand-strong);
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
  .home-card:hover .card-art {
    transform: translateY(-4px);
    box-shadow: var(--shadow-cover-hover);
  }
  .home-card:hover .card-name {
    color: var(--brand);
  }
  .home-card:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  /* 与目录网格同一套排版：标题 14、副文案 12 且上边距 6 */
  .card-name {
    overflow: hidden;
    color: var(--text);
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .card-meta {
    margin-top: 6px;
    overflow: hidden;
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* reduce：不打位移、播放钮直接出现（静态层次保留） */
  @media (prefers-reduced-motion: reduce) {
    .home-card:hover .card-art {
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
