<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import MarqueeText from '@/components/ui/MarqueeText.vue'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'

/**
 * 播放器左端：封面 + 曲名/副标题（音质·编码，或"已暂停"）。
 * 曲名用共享的 MarqueeText（旧站行为：溢出才滚、首尾 28px、悬停暂停）。
 * 收起态的尺寸差异也写在本组件里，用 :global 命中外壳的 .player.collapsed：
 * 收起状态在 store 上，子组件自己读，不在父子之间传 props。
 */
const player = usePlayerStore()
const { displayItem, subtitle } = usePlayerMeta()
</script>

<template>
  <button
    aria-label="打开歌词预览"
    class="cover-button"
    title="歌词预览"
    type="button"
    @click="player.openNowPlaying()"
  >
    <EntityCover :item="displayItem" />
  </button>
  <div class="player-title">
    <strong class="player-title-name"><MarqueeText :text="displayItem?.name" /></strong>
    <span>{{ subtitle }}</span>
  </div>
</template>

<style scoped>
@layer components {
  /* 封面是个按钮（打开全屏歌词预览）：它是 .player 的 flex 项，宽度与原来的 .cover 一致。
     收起态收到 38px：.collapsed 与 .player 是同一个元素，所以选择器要写成 .player.collapsed > …；
     :global 里必须给完整选择器 —— Vue 的 :global 只保留括号内的部分，括号外会被丢掉。 */
  .cover-button {
    display: block;
    width: 46px;
    flex-shrink: 0;
    padding: 0;
    border-radius: 10px;
    transition: width var(--motion-morph);
  }
  :global(.player.collapsed > .cover-button) {
    width: 38px;
  }
  /* EntityCover 的根元素（就是 .cover）撑满按钮 */
  .cover-button > .cover {
    width: 100%;
  }
  .player-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 168px;
    min-width: 0;
  }
  /* 曲名容器交给 MarqueeText 量宽（旧站同样只在这 168px 里滚） */
  .player-title-name {
    display: block;
    width: 100%;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .player-title span {
    font-size: 11px;
    color: var(--text-muted);
  }
  :global(.player.collapsed .player-title) {
    flex: 1;
    width: auto;
  }
  @media (max-width: 760px) {
    .player-title {
      width: 120px;
    }
  }
  @media (max-width: 540px) {
    .player-title {
      flex: 1;
      width: 100px;
    }
  }
}
</style>
