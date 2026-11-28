<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
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
 * 卡片左栏：大封面 + 曲名/歌手 + 底部一组（控制行 / 进度）。
 * 控制行与进度条直接复用 PlayerTransport / PlayerSeek / PlayerModeButton（stage / header 变体），
 * 不在页面里复制模板。
 *
 * 结构：.np-left（排版）→ .np-cover-wrap（定位参照 + 尺寸）→ .np-artwork（只包封面，FLIP 目标）
 *      + 移动端的圆形「显示歌词」按钮（浮在封面右下角，不参与布局）。
 * 封面单独一层是刻意的：.np-left 的盒子两态差别巨大（整块 → 44px 行），只有只包封面的
 * .np-artwork 才能做等比 FLIP；也正因为它在 FLIP 里被 scale，按钮必须放在它外面。
 */
const player = usePlayerStore()
const { displayItem, artist } = usePlayerMeta()

const compact = useMediaQuery('(max-width: 899px)')
/** 移动端的歌词态：本栏从整块封面收成一行 */
const header = computed(() => compact.value && player.nowPlayingLyrics)
/** 移动端封面态的「显示歌词」入口：浮在封面右下角的圆形按钮 */
const showLyricsEntry = computed(() => compact.value && !player.nowPlayingLyrics)

/** 两态切换用 FLIP：reduce 下 composable 内部直接切；桌面端没有切换入口，不会触发 */
const artworkEl = useTemplateRef<HTMLDivElement>('artworkEl')
const flip = useFlipMorph(artworkEl)

function setLyrics(open: boolean) {
  if (!compact.value) return
  void flip.run(() => player.setNowPlayingLyrics(open))
}
</script>

<template>
  <div :class="['np-left', { 'is-header': header }]">
    <div class="np-cover-wrap">
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
      <button
        v-if="showLyricsEntry"
        aria-label="显示歌词"
        class="np-show-lyrics"
        title="显示歌词"
        type="button"
        @click="setLyrics(true)"
      >
        <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
          <path d="M4 6h11M4 11h11M4 16h7" />
        </svg>
      </button>
    </div>
    <div class="np-meta">
      <!-- 桌面：两行截断（不滚）；移动端：跑马灯直接开滚（首帧静置会让人以为被截断） -->
      <h2 v-if="!compact" class="np-title np-title--clamp">{{ displayItem?.name }}</h2>
      <h2 v-else class="np-title"><MarqueeText :text="displayItem?.name" /></h2>
      <p v-if="artist" class="np-artist">{{ artist }}</p>
    </div>
    <div class="np-bottom">
      <div class="np-controls">
        <PlayerTransport :variant="header ? 'header' : 'stage'" />
        <PlayerModeButton v-if="!header" :in-player="false" />
      </div>
      <PlayerSeek v-if="!header" class="np-progress" variant="stage" />
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
  /* 封面定位参照 + 尺寸：跟着卡片高度走，保证「封面 + 信息 + 控制 + 进度」塞得进卡片。
     尺寸放这里（而不是 FLIP 目标上），FLIP 量到的盒子才是封面盒子本身。 */
  .np-cover-wrap {
    position: relative;
    flex-shrink: 0;
    width: min(100%, calc(var(--np-stage-height) * 0.52));
  }
  .np-artwork {
    position: relative;
    /* FLIP 期间封面会临时盖住信息行与歌词区，抬到最上面才不会被文字穿透 */
    z-index: 1;
    width: 100%;
    border-radius: 20px;
    box-shadow: 0 24px 60px color-mix(in srgb, var(--ink) 26%, transparent);
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
  /* 封面右下角的圆形「显示歌词」按钮：绝对定位，不占布局，也不会被 FLIP 缩放 */
  .np-show-lyrics {
    position: absolute;
    right: var(--space-2);
    bottom: var(--space-2);
    z-index: 2;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--brand);
    background: color-mix(in srgb, var(--surface) 74%, transparent);
    backdrop-filter: blur(8px);
  }
  .np-show-lyrics .ui-icon {
    width: 18px;
    height: 18px;
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
  /* 桌面标题：两行截断，静态看不再像被裁断 */
  .np-title--clamp {
    display: -webkit-box;
    overflow: hidden;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .np-artist {
    margin: var(--space-1) 0 0;
    color: var(--text-muted);
    font-size: 13px;
  }
  /* 底部一组：控制行 / 进度 */
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
  /* 移动端歌词态：整栏退化成一行（44px 封面 + 歌名/歌手两行 + 右侧播放控件） */
  .np-left.is-header {
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: var(--space-3);
  }
  .np-left.is-header .np-cover-wrap {
    width: 44px;
  }
  .np-left.is-header .np-artwork {
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
  /* 歌词态底部一组只剩右侧播放控件（进度条不渲染） */
  .np-left.is-header .np-bottom {
    flex: none;
    width: auto;
    gap: 0;
  }
  .np-left.is-header .np-controls {
    gap: var(--space-2);
  }
  @media (max-width: 899px) {
    /* 封面态：封面 / 信息 / 控制三段铺开；顶部让出关闭按钮那一条，底部留常规内边距 */
    /* 三段整体居中、统一 --space-6 间距（不再拉到两端，标题/歌手与实际控制行之间不再有大片空白）；
       顶部让出卡片里的关闭按钮那一条，底部留常规内边距 */
    .np-left:not(.is-header) {
      justify-content: center;
      gap: var(--space-6);
      padding-block-start: calc(44px + var(--space-2));
      padding-block-end: var(--space-6);
    }
    /* 封面按卡片高度比例取尺寸（844 → 324、667 → 285，都不小于 270），且不超出内容区 */
    .np-cover-wrap {
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
