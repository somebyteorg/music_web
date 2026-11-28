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
    :class="['cover-tile', 'home-card', 'home-card--' + variant, { 'is-playing': isPlaying }]"
    :to="to"
  >
    <EntityCover :item="item" />
    <span class="cover-tile-name">{{ item.name }}</span>
    <span class="cover-tile-meta">{{ artistsOf(item) }}</span>
  </RouterLink>
  <button
    v-else
    :aria-current="isPlaying ? 'true' : undefined"
    :aria-label="(isPlaying ? '正在播放 ' : '播放 ') + item.name"
    :class="['cover-tile', 'home-card', 'home-card--' + variant, { 'is-playing': isPlaying }]"
    type="button"
    @click="emit('play')"
  >
    <EntityCover :item="item" />
    <span v-if="showPlay" aria-hidden="true" class="card-play">
      <svg class="ui-icon" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7Z" /></svg>
    </span>
    <span class="cover-tile-name">{{ item.name }}</span>
    <span class="cover-tile-meta">{{ hint || artistsOf(item) }}</span>
  </button>
</template>

<style scoped>
@layer components {
  /* 排版、封面圆角/阴影、标题与副文案全部来自共享的 .cover-tile（components.css）；
     这里只留首页特有的：列宽、竖版比例、hover 播放钮 */
  .home-card {
    position: relative;
    flex: 0 0 176px;
    width: 176px;
    padding: 0;
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
  /* 收藏的竖版卡：封面框 4:5 */
  .home-card--poster > .cover {
    aspect-ratio: 4 / 5;
  }
  /* hover 播放钮：盖住封面那块（宽高比与封面一致），默认透明，hover / 键盘聚焦时淡入 */
  .card-play {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border-radius: var(--radius-cover);
    background: color-mix(in srgb, var(--ink) 28%, transparent);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .home-card--poster .card-play {
    aspect-ratio: 4 / 5;
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
}
</style>
