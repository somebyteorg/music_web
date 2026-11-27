<script setup lang="ts">
/** 分段控件 / 页签：替代 .segmented 与 .detail-tabs。 */
withDefaults(
  defineProps<{
    variant?: 'segmented' | 'underline'
    label?: string
  }>(),
  { variant: 'segmented' },
)
</script>

<template>
  <div :class="['ui-tabs', `ui-tabs--${variant}`]" :aria-label="label">
    <slot />
  </div>
</template>

<style scoped>
.ui-tabs--segmented {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--surface-sunken);
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
  box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 6.3%, transparent);
}
</style>
