<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import PlayModeIcon from '@/components/PlayModeIcon.vue'
import { usePlayerMeta } from '@/composables/usePlayerMeta'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'

/**
 * 循环模式按钮：播放器外框与全屏歌词页共用的唯一实现（IconButton + PlayModeIcon + cycleMode）。
 * in-player 的两条规则只属于播放器（收起态让位、窄屏隐藏），全屏页没有收起态。
 */
withDefaults(defineProps<{ inPlayer?: boolean }>(), { inPlayer: true })

const player = usePlayerStore()
const queue = useQueueStore()
const { modeLabel } = usePlayerMeta()
</script>

<template>
  <IconButton
    :aria-hidden="inPlayer && player.collapsed"
    :class="['mode-button', { 'in-player': inPlayer }]"
    :label="modeLabel"
    :size="inPlayer ? 'md' : 'lg'"
    :tabindex="inPlayer && player.collapsed ? -1 : 0"
    :title="modeLabel"
    @click="queue.cycleMode()"
  >
    <PlayModeIcon :mode="queue.mode" />
  </IconButton>
</template>

<style scoped>
@layer components {
  .mode-button {
    transition:
      width var(--motion-morph),
      min-width var(--motion-morph),
      opacity var(--motion-morph);
  }
  /* 收起时让出「循环模式」这 32px 给标题（宽度与透明度一起过渡，避免突然消失） */
  :global(.player.collapsed .mode-button.in-player) {
    width: 0;
    min-width: 0;
    padding-inline: 0;
    border-width: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
  }
  @media (max-width: 980px) {
    .mode-button.in-player {
      display: none;
    }
  }
}
</style>
