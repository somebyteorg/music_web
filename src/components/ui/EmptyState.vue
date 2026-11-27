<script setup lang="ts">
import Card from './Card.vue'

/**
 * 空状态：可选符号 + 标题 + 描述 + 操作。
 * panel 为 true 时根元素直接用 Card，卡片视觉由 Card 自己的 scoped 样式提供。
 */
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
  <component
    :is="panel ? Card : 'div'"
    :class="['ui-placeholder', { 'ui-placeholder--compact': compact }]"
  >
    <span v-if="symbol" class="ui-placeholder__symbol">{{ symbol }}</span>
    <component :is="as" v-if="title">{{ title }}</component>
    <p v-if="$slots.default"><slot /></p>
    <slot name="actions" />
  </component>
</template>

<style scoped>
.ui-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 56px 24px;
  text-align: center;
}

.ui-placeholder--compact {
  padding: 32px 20px;
}

.ui-placeholder__symbol {
  color: var(--text-muted);
  font-size: 26px;
  line-height: 1.2;
}

.ui-placeholder h2 {
  font-size: var(--font-lg);
}

.ui-placeholder p {
  max-width: 440px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
