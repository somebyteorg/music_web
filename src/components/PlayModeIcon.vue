<script lang="ts" setup>
import type { PlayMode } from '@/stores/queue'

defineProps<{ mode: PlayMode }>()
</script>

<template>
  <!-- 24 网格、1.6 描边，与全局 .ui-icon 体系一致；每档都是完整可辨的独立图形。 -->
  <span class="play-mode">
    <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
      <template v-if="mode === 'order'">
        <path d="M4 6h9M4 12h9M4 18h9" />
        <path d="M19 5v14M16.5 16.5 19 19l2.5-2.5" />
      </template>
      <template v-else-if="mode === 'repeat-all'">
        <path d="M4 11V9a3 3 0 0 1 3-3h13" />
        <path d="M16 2l4 4-4 4" />
        <path d="M20 13v2a3 3 0 0 1-3 3H4" />
        <path d="M8 22l-4-4 4-4" />
      </template>
      <template v-else-if="mode === 'repeat-one'">
        <path d="M4 11V9a3 3 0 0 1 3-3h13" />
        <path d="M16 2l4 4-4 4" />
        <path d="M20 13v2a3 3 0 0 1-3 3H4" />
        <path d="M8 22l-4-4 4-4" />
      </template>
      <template v-else>
        <path d="M16 3h5v5" />
        <path d="M4 20 21 3" />
        <path d="M21 16v5h-5" />
        <path d="M15 15l6 6" />
        <path d="M4 4l5 5" />
      </template>
    </svg>
    <span v-if="mode === 'repeat-one'" aria-hidden="true" class="mode-one">1</span>
  </span>
</template>

<style scoped>
.play-mode {
  position: relative;
  display: grid;
  place-items: center;
}
/* 单曲循环：同一个循环符号 + 居中的 1，避免小尺寸下与列表循环混淆 */
.mode-one {
  position: absolute;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}
</style>
