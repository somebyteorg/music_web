<script setup lang="ts">
/**
 * 分段控件 / 页签：替代 .segmented 与 .detail-tabs。
 * size="lg" 是大尺寸档：按钮桌面 34px、窄屏 40px（触摸更好点），只改高度不复制组件。
 */
withDefaults(
  defineProps<{
    variant?: 'segmented' | 'underline'
    size?: 'md' | 'lg'
    label?: string
  }>(),
  { variant: 'segmented', size: 'md' },
)
</script>

<template>
  <div
    :class="['ui-tabs', `ui-tabs--${variant}`, { 'ui-tabs--lg': size === 'lg' }]"
    :aria-label="label"
  >
    <slot />
  </div>
</template>

<style scoped>
@layer components {
  .ui-tabs--segmented {
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--segmented-bg);
    border-radius: var(--radius-sm);
  }

  .ui-tabs--segmented > :deep(button) {
    flex: 1;
    padding: 6px 10px;
    border-radius: 4px;
    color: var(--text-muted);
    font-size: var(--font-sm);
    white-space: nowrap;
  }

  .ui-tabs--segmented > :deep(button.active) {
    background: var(--surface);
    color: var(--brand-strong);
    box-shadow: var(--shadow-segmented);
  }

  /* 大尺寸档：按钮高 34（桌面）/ 40（窄屏触摸） */
  .ui-tabs--segmented.ui-tabs--lg > :deep(button) {
    min-height: 34px;
    padding-block: 6px;
  }

  @media (max-width: 899px) {
    .ui-tabs--segmented.ui-tabs--lg > :deep(button) {
      min-height: 40px;
      padding-block: 10px;
    }
  }
}
</style>
