<script lang="ts" setup>
import HomeCard from './HomeCard.vue'
import HomeChipCard from './HomeChipCard.vue'
import HomeVinylCard from './HomeVinylCard.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { useScrollFade } from '@/composables/useScrollFade'
import type { HomeRow } from '@/features/home/useHomeFloors'
import { computed, useTemplateRef } from 'vue'

/**
 * 一层楼层：17px 标题 + 说明（12px muted）+ 右侧文字按钮；下面是横向滚动行。
 * 卡型按楼层语义分工（数据层不变，只在渲染层决定）：
 *   artist:* → 封面卡 176 / latest → 封面卡 160（hover 播放钮）/ albums → 黑胶盘 /
 *   random → 紧凑 chip 264×64 / favorites → 竖版卡 144×180
 * 横向行聚焦后浏览器原生左右方向键滚动（tabindex=0 + role=region），两端渐隐复用 useScrollFade 横轴模式。
 */
const props = defineProps<{ row: HomeRow }>()
const emit = defineEmits<{ play: []; 'play-item': [index: number]; reshuffle: [] }>()

const scroller = useTemplateRef<HTMLDivElement>('scroller')
useScrollFade(scroller, 'x')

const kind = computed(() => {
  const key = props.row.key
  if (key.startsWith('artist:')) return 'cover'
  if (key === 'latest') return 'cover-play'
  if (key === 'albums') return 'vinyl'
  if (key === 'random') return 'chip'
  return 'poster'
})
</script>

<template>
  <section :aria-label="row.title" class="home-row">
    <header class="home-row-head">
      <div class="home-row-titles">
        <h2>{{ row.title }}</h2>
        <p v-if="row.subtitle" class="home-row-sub">{{ row.subtitle }}</p>
      </div>
      <div class="home-row-actions">
        <TextButton v-if="row.songs.length" :aria-label="row.playLabel" @click="emit('play')">
          全部播放
        </TextButton>
        <TextButton v-if="row.reshuffle" @click="emit('reshuffle')">换一批</TextButton>
      </div>
    </header>
    <div
      ref="scroller"
      :aria-label="row.title + '：横向列表，聚焦后可用左右方向键滚动'"
      class="home-row-scroller scroll-fade-x"
      role="region"
      tabindex="0"
    >
      <template v-if="kind === 'vinyl'">
        <HomeVinylCard v-for="album in row.albums" :key="album.id" :album="album" />
      </template>
      <template v-else-if="kind === 'chip'">
        <HomeChipCard
          v-for="(song, index) in row.songs"
          :key="song.id"
          :song="song"
          @play="emit('play-item', index)"
        />
      </template>
      <template v-else>
        <HomeCard
          v-for="(song, index) in row.songs"
          :key="song.id"
          :hint="row.hints[song.id]"
          :item="song"
          :show-play="kind === 'cover-play'"
          :variant="kind === 'poster' ? 'poster' : kind === 'cover-play' ? 'cover-play' : 'cover'"
          @play="emit('play-item', index)"
        />
        <HomeCard
          v-for="album in row.albums"
          :key="album.id"
          :item="album"
          :to="'/albums/' + album.id"
        />
      </template>
    </div>
  </section>
</template>

<style scoped>
@layer components {
  .home-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    margin-bottom: 44px;
  }
  .home-row-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .home-row-titles h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }
  /* 说明文字降级为 12px muted，不再抢标题的层次 */
  .home-row-sub {
    margin: 2px 0 0;
    color: var(--text-muted);
    font-size: var(--font-sm);
  }
  .home-row-actions {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-shrink: 0;
  }
  .home-row-scroller {
    display: flex;
    gap: var(--space-3);
    padding-bottom: var(--space-1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scroll-snap-type: x proximity;
  }
  .home-row-scroller:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }
  @media (max-width: 899px) {
    .home-row {
      gap: var(--space-3);
      margin-bottom: 32px;
    }
    .home-row-actions {
      gap: var(--space-3);
    }
  }
}
</style>
