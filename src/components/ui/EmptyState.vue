<script setup lang="ts">
/** 空状态：替代 .empty / .empty.compact 那套结构（符号 + 标题 + 描述 + 操作）。 */
withDefaults(
  defineProps<{
    symbol: string
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
    <span class="empty-symbol">{{ symbol }}</span>
    <component :is="as" v-if="title">{{ title }}</component>
    <p v-if="$slots.default"><slot /></p>
    <slot name="actions" />
  </div>
</template>
