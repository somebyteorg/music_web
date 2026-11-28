<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import Button from '@/components/ui/Button.vue'
import MarqueeText from '@/components/ui/MarqueeText.vue'
import PlayerModeButton from '@/components/player/PlayerModeButton.vue'
import PlayerSeek from '@/components/player/PlayerSeek.vue'
import PlayerTransport from '@/components/player/PlayerTransport.vue'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'
import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'

/**
 * 预览页左栏：大封面 + 曲名/歌手 + 底部一组（控制行 / 进度 / 移动端「显示歌词」）。
 * 控制行与进度条直接复用播放器的 PlayerTransport / PlayerSeek / PlayerModeButton（variant="stage"），
 * 不在这里再写一份「上一首/播放/下一首」。曲名用共享的 MarqueeText。
 * 尺寸跟着舞台高度走（--np-stage-height），左栏内容不会把舞台撑高。
 * 移动端（≤899px）封面态是竖排三段、按可用高度分开；歌词态整栏收成顶部一行。
 */
const player = usePlayerStore()
const { displayItem, artist } = usePlayerMeta()

const compact = useMediaQuery('(max-width: 899px)')
/** 移动端的歌词态：本栏从整块封面收成顶部一行 */
const header = computed(() => compact.value && player.nowPlayingLyrics)
/** 移动端封面态的「显示歌词」入口：参加布局，不再浮在进度条右下 */
const showLyricsEntry = computed(() => compact.value && !player.nowPlayingLyrics)
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
    <div class="np-bottom">
      <div class="np-controls">
        <PlayerTransport variant="stage" />
        <PlayerModeButton :in-player="false" />
      </div>
      <PlayerSeek class="np-progress" variant="stage" />
      <Button
        v-if="showLyricsEntry"
        aria-label="显示歌词"
        class="np-show-lyrics"
        type="button"
        variant="secondary"
        @click="player.setNowPlayingLyrics(true)"
      >
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path d="M4 6h11M4 11h11M4 16h7" />
        </svg>
        显示歌词
      </Button>
    </div>
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
  /* 底部一组：控制行 / 进度 / 移动端入口，桌面端与封面、信息同列 */
  .np-bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    width: 100%;
    min-width: 0;
  }
  .np-controls {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .np-bottom .np-show-lyrics {
    width: 100%;
    min-height: 44px;
  }
  /* 移动端歌词态：整栏退化成一行（44px 小封面 + 歌名/歌手两行），底部一组让位给歌词 */
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
  .np-artwork.is-header .np-bottom {
    display: none;
  }
  @media (max-width: 899px) {
    /* 封面态：三段（封面 / 信息 / 底部一组）按可用高度铺开，吃满舞台而不是挤在中间 */
    .np-artwork:not(.is-header) {
      justify-content: space-between;
      gap: var(--space-3);
      padding-block: var(--space-5);
    }
    /* 封面按舞台高度比例放大，不再用 60vw / 280px 这类固定值 */
    .np-artwork .np-cover,
    .np-artwork .np-cover-button {
      width: min(86vw, calc(var(--np-stage-height) * 0.46));
    }
    .np-title {
      font-size: 22px;
    }
    .np-artist {
      margin-top: var(--space-2);
      font-size: 14px;
    }
    .np-artwork:not(.is-header) .np-bottom {
      gap: var(--space-3);
    }
    /* 进度条整行宽，两侧留出内边距，不再被浮动按钮压住 */
    .np-artwork:not(.is-header) .np-progress {
      width: 100%;
      padding-inline: var(--space-3);
    }
  }
}
</style>
