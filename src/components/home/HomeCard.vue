<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import type { Entity } from '@/types/catalog'

/**
 * 首页卡片：歌曲卡是原生按钮（Tab 可达、Enter/Space 播放），专辑卡是链接（进详情页）。
 * 两种卡共用这一份视觉，避免两份一样的样式。
 */
defineProps<{
  item: Entity
  /** 副文案：继续听显示播放进度，其余显示歌手 */
  hint?: string
  /** 传了就是 RouterLink（专辑卡），不传就是按钮（歌曲卡） */
  to?: string
}>()
const emit = defineEmits<{ play: [] }>()

function artistsOf(item: Entity) {
  const artists = item.artists
  if (!artists || artists.length === 0) return '未填写歌手'
  return artists.map((artist) => artist.name).join(' / ')
}
</script>

<template>
  <RouterLink v-if="to" :aria-label="'打开专辑 ' + item.name" class="home-card" :to="to">
    <EntityCover :item="item" />
    <span class="home-card-name">{{ item.name }}</span>
    <span class="home-card-meta">{{ artistsOf(item) }}</span>
  </RouterLink>
  <button
    v-else
    :aria-label="'播放 ' + item.name"
    class="home-card"
    type="button"
    @click="emit('play')"
  >
    <EntityCover :item="item" />
    <span class="home-card-name">{{ item.name }}</span>
    <span class="home-card-meta">{{ hint || artistsOf(item) }}</span>
  </button>
</template>

<style scoped>
@layer components {
  .home-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    flex: 0 0 148px;
    width: 148px;
    padding: var(--space-2);
    border-radius: var(--radius-lg);
    text-align: left;
    scroll-snap-align: start;
    transition:
      background var(--transition-fast),
      transform var(--transition-fast);
  }
  .home-card:hover {
    background: var(--surface-hover);
  }
  .home-card > .cover {
    width: 100%;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-cover);
  }
  .home-card-name {
    overflow: hidden;
    color: var(--text);
    font-size: var(--font-base);
    font-weight: 550;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .home-card-meta {
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-xs);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
