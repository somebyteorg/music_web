<script setup lang="ts">
/**
 * 卡片容器。默认不加内边距（与既有 .panel 用法一致，页面各自管自己的 padding），
 * 需要时用 padding 打开。.panel 的底色/描边/圆角/阴影仍是全局单一来源。
 */
withDefaults(
  defineProps<{
    as?: string
    padding?: 'sm' | 'md' | 'lg'
  }>(),
  { as: 'div' },
)
</script>

<template>
  <component :is="as" :class="['panel', padding && `ui-card--pad-${padding}`]">
    <slot />
  </component>
</template>

<style scoped>
.ui-card--pad-sm {
  padding: var(--space-3);
}

.ui-card--pad-md {
  padding: var(--space-4);
}

.ui-card--pad-lg {
  padding: var(--space-6);
}
</style>
