<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import Button from '@/components/ui/Button.vue'
import MarqueeText from '@/components/ui/MarqueeText.vue'
import PlayerModeButton from '@/components/player/PlayerModeButton.vue'
import PlayerSeek from '@/components/player/PlayerSeek.vue'
import PlayerTransport from '@/components/player/PlayerTransport.vue'
import { useFlipMorph } from '@/composables/useFlipMorph'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'
import { useMediaQuery } from '@vueuse/core'
import { computed, useTemplateRef } from 'vue'

/**
 * 预览页左栏：大封面 + 曲名/歌手 + 底部一组（控制行 / 进度 / 移动端「显示歌词」）。
 * 控制行与进度条直接复用播放器的 PlayerTransport / PlayerSeek / PlayerModeButton（variant="stage"），
 * 不在这里再写一份「上一首/播放/下一首」。曲名用共享的 MarqueeText。
 *
 * 结构：.np-left（整栏，负责排版）→ .np-artwork（只包封面，两态切换的 FLIP 目标）+ .np-meta + .np-bottom。
 * 封面单独一层是刻意的：.np-left 的盒子在两种态里是 358×796 → 358×44，非等比缩放会把内容拉成竖条，
 * 只有「只包封面」的 .np-artwork 才能做等比 FLIP（大图 → 头部 44px 小图，仍是同一个 DOM 元素）。
 */
const player = usePlayerStore()
const { displayItem, artist } = usePlayerMeta()

const compact = useMediaQuery('(max-width: 899px)')
/** 移动端的歌词态：本栏从整块封面收成一行 */
const header = computed(() => compact.value && player.nowPlayingLyrics)
/** 移动端封面态的「显示歌词」入口：参加布局，不再浮在进度条右下 */
const showLyricsEntry = computed(() => compact.value && !player.nowPlayingLyrics)

/** 两态切换用 FLIP：reduce 下 composable 内部直接切；桌面端这两个入口不存在，不会触发 */
const artworkEl = useTemplateRef<HTMLDivElement>('artworkEl')
const flip = useFlipMorph(artworkEl)

function setLyrics(open: boolean) {
  if (!compact.value) return
  void flip.run(() => player.setNowPlayingLyrics(open))
}
</script>

<template>
  <div :class="['np-left', { 'is-header': header }]">
    <div ref="artworkEl" class="np-artwork">
      <button
        v-if="compact"
        :aria-label="header ? '收起歌词' : '显示歌词'"
        :title="header ? '收起歌词' : '显示歌词'"
        class="np-cover-button"
        type="button"
        @click="setLyrics(!header)"
      >
        <EntityCover :item="displayItem" />
      </button>
      <EntityCover v-else :item="displayItem" />
    </div>
    <div class="np-meta">
      <h2 class="np-title"><MarqueeText :text="displayItem?.name" /></h2>
      <p v-if="artist" class="np-artist">{{ artist }}</p>
    </div>
    <div class="np-bottom">
      <div class="np-controls">
        <PlayerTransport :variant="header ? 'header' : 'stage'" />
        <PlayerModeButton v-if="!header" :in-player="false" />
      </div>
      <PlayerSeek v-if="!header" class="np-progress" variant="stage" />
      <Button
        v-if="showLyricsEntry"
        aria-label="显示歌词"
        class="np-show-lyrics"
        type="button"
        variant="secondary"
        @click="setLyrics(true)"
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
  .np-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    width: 100%;
    min-width: 0;
    min-height: 0;
  }
  /* 封面框：尺寸跟着舞台高度走（--np-stage-height），保证「封面 + 信息 + 控制 + 进度」塞得进等高舞台。
     圆角/阴影带过渡跟着 FLIP 一起变；尺寸交给 FLIP 的 transform，width 不再过渡，
     否则 FLIP 量到的 last 矩形会停在旧宽度上。 */
  .np-artwork {
    position: relative;
    /* FLIP 期间封面会临时盖住信息行与歌词区，抬到最上面才不会被文字穿透 */
    z-index: 1;
    flex-shrink: 0;
    /* 卡片有 padding，封面按卡片高度取 52%，保证「封面 + 信息 + 控制 + 进度」不撑破卡片 */
    width: min(100%, calc(var(--np-stage-height) * 0.52));
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    transition:
      border-radius var(--motion-morph),
      box-shadow var(--motion-morph);
  }
  .np-cover-button {
    display: block;
    width: 100%;
    padding: 0;
    background: none;
    border-radius: inherit;
  }
  /* EntityCover 的根元素，圆角跟着封面框走 */
  .np-artwork .cover {
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
  /* 底部一组：控制行 / 进度 / 移动端入口 */
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
  /* 移动端歌词态：整栏退化成一行（44px 封面 + 歌名/歌手两行 + 右侧播放控件）。
     这一行在舞台里靠顶部 padding 让开关闭按钮，不用再给 × 单独让位。 */
  .np-left.is-header {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-3);
  }
  .np-left.is-header .np-artwork {
    width: 44px;
    border-radius: var(--radius-md);
    box-shadow: none;
  }
  .np-left.is-header .np-meta {
    flex: 1;
    min-width: 0;
    max-width: none;
    text-align: left;
  }
  .np-left.is-header .np-title {
    font-size: 17px;
    line-height: 1.4;
  }
  .np-left.is-header .np-artist {
    margin: 0;
    overflow: hidden;
    font-size: 12px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* 歌词态底部一组只剩右侧播放控件（进度条与「显示歌词」都不渲染） */
  .np-left.is-header .np-bottom {
    flex: none;
    width: auto;
    gap: 0;
  }
  .np-left.is-header .np-controls {
    gap: var(--space-2);
  }
  @media (max-width: 899px) {
    /* 封面态：三段（封面 / 信息 / 底部一组）按可用高度均匀铺开，
       space-evenly 让「信息 → 控制」之间不再留出空档，也不贴边 */
    .np-left:not(.is-header) {
      justify-content: space-evenly;
      gap: 0;
      /* 顶部的关闭按钮现在在卡片里，这一栏要让出它那一条 */
      padding-block-start: calc(44px + var(--space-2));
      padding-block-end: var(--space-6);
    }
    /* 封面按卡片高度比例取尺寸，且不超出卡片内容区 */
    .np-artwork {
      width: min(100%, calc(var(--np-stage-height) * 0.46));
    }
    .np-title {
      font-size: 22px;
    }
    .np-artist {
      margin-top: var(--space-2);
      font-size: 14px;
    }
    .np-left:not(.is-header) .np-bottom {
      gap: var(--space-3);
    }
    /* 进度条整行宽，两侧留出内边距 */
    .np-left:not(.is-header) .np-progress {
      width: 100%;
      padding-inline: var(--space-3);
    }
  }
}
</style>
