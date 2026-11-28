<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'

/**
 * 上一首 / 播放暂停 / 下一首：播放器外框与全屏歌词页共用，尺寸差异走 variant。
 * - bar：播放器外框
 * - stage：全屏舞台（52px 播放键、窄屏也保留前后切歌）
 * - header：移动端歌词态的信息行，只留播放/暂停 + 下一首（40px，塞在书名号那一行里）
 * 三档都不复制模板，只在样式与「显示哪几个键」上分支。
 */
withDefaults(defineProps<{ variant?: 'bar' | 'stage' | 'header' }>(), { variant: 'bar' })

const player = usePlayerStore()
const queue = useQueueStore()
</script>

<template>
  <div
    :class="[
      'player-controls',
      { 'is-stage': variant === 'stage', 'is-header': variant === 'header' },
    ]"
  >
    <IconButton
      v-if="variant !== 'header'"
      :size="variant === 'bar' ? 'md' : 'lg'"
      label="上一首"
      :disabled="!queue.length"
      title="上一首"
      @click="player.previous()"
    >
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="M7 5v14M19 5l-9 7 9 7Z" /></svg></IconButton
    ><button
      :aria-busy="player.loading"
      :aria-label="player.playing ? '暂停' : '播放'"
      :title="player.playing ? '暂停' : '播放'"
      class="play-button"
      @click="player.toggle()"
    >
      <svg aria-hidden="true" class="ui-icon playback-icon" viewBox="0 0 24 24">
        <path :d="player.playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'm8 5 11 7-11 7Z'" />
      </svg></button
    ><IconButton
      :size="variant === 'bar' ? 'md' : 'lg'"
      label="下一首"
      :disabled="!queue.length"
      title="下一首"
      @click="player.next()"
    >
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="M17 5v14M5 5l9 7-9 7Z" />
      </svg>
    </IconButton>
  </div>
</template>

<style scoped>
@layer components {
  .player-controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .player-controls .icon-button {
    color: var(--text-muted);
  }
  .play-button {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    color: var(--on-brand);
    background: var(--brand);
  }
  .play-button[aria-busy='true'] {
    opacity: 0.6;
  }
  /* 全屏页：整组放大到 52px，前后切歌永远保留（窄屏也不收） */
  .player-controls.is-stage {
    gap: var(--space-3);
  }
  .player-controls.is-stage .play-button {
    width: 52px;
    height: 52px;
    /* 舞台是玻璃卡片，播放键要浮起来 */
    box-shadow: 0 10px 28px color-mix(in srgb, var(--brand) 35%, transparent);
  }
  .player-controls.is-stage .play-button .ui-icon {
    width: 22px;
    height: 22px;
  }
  /* 移动端歌词态信息行：播放键 44px，前后切歌走 IconButton 的 lg 热区档 */
  .player-controls.is-header {
    gap: var(--space-2);
  }
  .player-controls.is-header .play-button {
    width: 44px;
    height: 44px;
  }
  /* 移动端全屏舞台：播放键 56px（前后切歌的热区同样走 lg 档） */
  @media (max-width: 899px) {
    .player-controls.is-stage {
      gap: var(--space-4);
    }
    .player-controls.is-stage .play-button {
      width: 56px;
      height: 56px;
    }
  }
  @media (max-width: 540px) {
    /* 只收播放器外框的前后切歌；全屏舞台与歌词态信息行都要保留 */
    .player-controls:not(.is-stage):not(.is-header) .icon-button {
      display: none;
    }
  }
}
</style>
