<script setup lang="ts">
/**
 * 卡片容器。默认不加内边距（页面各自管自己的 padding），需要时用 padding 打开。
 * 底色/描边/圆角/阴影由本组件的 <style scoped> 提供，不再依赖全局 .panel。
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
  <component :is="as" :class="['ui-card', padding && `ui-card--pad-${padding}`]">
    <slot />
  </component>
</template>

<style scoped>
@layer components {
  .ui-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .ui-card--pad-sm {
    padding: var(--space-3);
  }

  .ui-card--pad-md {
    padding: var(--space-4);
  }

  .ui-card--pad-lg {
    padding: var(--space-6);
  }
}
</style>
