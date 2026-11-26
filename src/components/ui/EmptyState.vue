<script setup lang="ts">
/** 空状态：替代 .empty / .empty.compact 那套结构（可选符号 + 标题 + 描述 + 操作）。 */
withDefaults(
  defineProps<{
    /** 符号/图标字符，省略时不渲染符号行（上传队列的空态原本就没有符号，保持视觉不变） */
    symbol?: string
    title?: string
    as?: 'h1' | 'h2' | 'h3'
    compact?: boolean
    panel?: boolean
  }>(),
  { as: 'h2' },
)
</script>

<template>
  <div :class="['empty', { compact, panel }]">
    <span v-if="symbol" class="empty-symbol">{{ symbol }}</span>
    <component :is="as" v-if="title">{{ title }}</component>
    <p v-if="$slots.default"><slot /></p>
    <slot name="actions" />
  </div>
</template>
