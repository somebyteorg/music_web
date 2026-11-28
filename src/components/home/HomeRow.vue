<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import HomeCard from './HomeCard.vue'
import { useScrollFade } from '@/composables/useScrollFade'
import type { HomeRow } from '@/features/home/useHomeFloors'
import { useTemplateRef } from 'vue'

/**
 * 一层楼层：标题 + 右侧动作（全部播放 / 换一批）+ 横向滚动行。
 * 横向行聚焦后浏览器原生就用左右方向键滚动（tabindex=0 + role=region），卡片本身是按钮/链接，
 * Tab 逐张可达、Enter/Space 触发；两端渐隐复用共享的 useScrollFade 横轴模式。
 */
defineProps<{ row: HomeRow }>()
const emit = defineEmits<{ play: []; 'play-item': [index: number]; reshuffle: [] }>()

const scroller = useTemplateRef<HTMLDivElement>('scroller')
useScrollFade(scroller, 'x')
</script>

<template>
  <section class="home-row" :aria-label="row.title">
    <header class="home-row-head">
      <div class="home-row-title">
        <h2>{{ row.title }}</h2>
        <p v-if="row.subtitle" class="home-row-sub">{{ row.subtitle }}</p>
      </div>
      <div class="home-row-actions">
        <Button v-if="row.songs.length" size="sm" variant="secondary" @click="emit('play')">
          {{ row.playLabel || '全部播放' }}
        </Button>
        <Button v-if="row.reshuffle" size="sm" variant="secondary" @click="emit('reshuffle')">
          换一批
        </Button>
      </div>
    </header>
    <div
      ref="scroller"
      :aria-label="row.title + '：横向列表，聚焦后可用左右方向键滚动'"
      class="home-row-scroller scroll-fade-x"
      role="region"
      tabindex="0"
    >
      <HomeCard
        v-for="(song, index) in row.songs"
        :key="song.id"
        :hint="row.hints[song.id]"
        :item="song"
        @play="emit('play-item', index)"
      />
      <HomeCard
        v-for="album in row.albums"
        :key="album.id"
        :item="album"
        :to="'/albums/' + album.id"
      />
    </div>
  </section>
</template>

<style scoped>
@layer components {
  .home-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-bottom: var(--space-7);
  }
  .home-row-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .home-row-title h2 {
    margin: 0;
    font-size: var(--font-lg);
  }
  .home-row-sub {
    margin: 2px 0 0;
    color: var(--text-muted);
    font-size: var(--font-sm);
  }
  .home-row-actions {
    display: flex;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .home-row-scroller {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
    padding-bottom: var(--space-2);
  }
}
</style>
