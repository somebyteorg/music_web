<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import MarqueeText from '@/components/ui/MarqueeText.vue'
import PlayerModeButton from '@/components/player/PlayerModeButton.vue'
import PlayerSeek from '@/components/player/PlayerSeek.vue'
import PlayerTransport from '@/components/player/PlayerTransport.vue'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'
import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'

/**
 * 预览页左栏：大封面 + 曲名/歌手 + 控制行（循环模式）。
 * 控制行与进度条直接复用播放器的 PlayerTransport / PlayerSeek / PlayerModeButton（variant="stage"），
 * 不在这里再写一份「上一首/播放/下一首」。曲名用共享的 MarqueeText。
 * 尺寸跟着舞台高度走（--np-stage-height），左栏内容不会把舞台撑高。
 * 移动端（≤899px）封面是按钮：点它切入歌词态；切过去后本栏收成顶部一行（44px 小封面 + 两行信息）。
 */
const player = usePlayerStore()
const { displayItem, artist } = usePlayerMeta()

const compact = useMediaQuery('(max-width: 899px)')
/** 移动端的歌词态：本栏从整块封面收成顶部一行 */
const header = computed(() => compact.value && player.nowPlayingLyrics)
</script>

<template>
  <div :class="['np-artwork', { 'is-header': header }]">
    <button
      v-if="compact"
      :aria-label="header ? '收起歌词' : '显示歌词'"
      :title="header ? '收起歌词' : '显示歌词'"
      class="np-cover-button"
      type="button"
      @click="player.toggleNowPlayingLyrics()"
    >
      <EntityCover :item="displayItem" />
    </button>
    <EntityCover v-else class="np-cover" :item="displayItem" />
    <div class="np-meta">
      <h2 class="np-title"><MarqueeText :text="displayItem?.name" /></h2>
      <p v-if="artist" class="np-artist">{{ artist }}</p>
    </div>
    <div class="np-controls">
      <PlayerTransport variant="stage" />
      <PlayerModeButton :in-player="false" />
    </div>
    <PlayerSeek class="np-progress" variant="stage" />
  </div>
</template>

<style scoped>
@layer components {
  .np-artwork {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    width: 100%;
    min-width: 0;
    min-height: 0;
  }
  /* 封面（裸 EntityCover 与移动端按钮两种外壳共用一套尺寸）：
     宽度上限取舞台高度的 60%，保证「封面 + 信息 + 控制 + 进度」整套塞得进等高舞台；
     宽度/圆角/阴影都带过渡，移动端切歌词态时封面是"缩"过去而不是跳过去 */
  .np-artwork .np-cover,
  .np-artwork .np-cover-button {
    width: min(100%, calc(var(--np-stage-height) * 0.6));
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    transition:
      width var(--motion-morph),
      border-radius var(--motion-morph),
      box-shadow var(--motion-morph);
  }
  .np-cover-button {
    display: block;
    flex-shrink: 0;
    padding: 0;
    background: none;
  }
  /* EntityCover 的根元素，圆角跟着上面的外壳走 */
  .np-cover-button > .cover {
    width: 100%;
    border-radius: inherit;
  }
  .np-meta {
    width: 100%;
    max-width: min(420px, 100%);
    text-align: center;
  }
  .np-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.35;
  }
  .np-artist {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }
  .np-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  /* 移动端歌词态：整栏退化成一行（44px 小封面 + 歌名/歌手两行），控制行让位给歌词 */
  .np-artwork.is-header {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-3);
    /* 右上角的关闭按钮浮在页面上，这一行要给它让出位置，别让歌名压到 × 下面 */
    padding-inline-end: var(--space-8);
  }
  .np-artwork.is-header .np-cover,
  .np-artwork.is-header .np-cover-button {
    width: 44px;
    border-radius: var(--radius-md);
    box-shadow: none;
  }
  .np-artwork.is-header .np-meta {
    flex: 1;
    min-width: 0;
    max-width: none;
    text-align: left;
  }
  .np-artwork.is-header .np-title {
    font-size: 15px;
    line-height: 1.4;
  }
  .np-artwork.is-header .np-artist {
    margin: 0;
    overflow: hidden;
    font-size: 12px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .np-artwork.is-header .np-controls,
  .np-artwork.is-header .np-progress {
    display: none;
  }
  @media (max-width: 899px) {
    .np-artwork {
      gap: var(--space-3);
    }
    /* 竖排：封面按屏宽收（60vw，最多 280px），另外还要让得开舞台高度 */
    .np-artwork .np-cover,
    .np-artwork .np-cover-button {
      width: min(60vw, 280px, calc(var(--np-stage-height) * 0.6));
    }
    .np-title {
      font-size: 18px;
    }
  }
}
</style>
