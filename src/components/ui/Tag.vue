<script setup lang="ts">
/** 标签：替代 .badge / .badge.quiet / .badge.warning。 */
withDefaults(
  defineProps<{
    variant?: 'default' | 'brand' | 'warning' | 'success' | 'danger'
  }>(),
  { variant: 'brand' },
)
</script>

<template>
  <span :class="['ui-tag', `ui-tag--${variant}`]"><slot /></span>
</template>

<style scoped>
@layer components {
  .ui-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: var(--font-xs);
    font-weight: 500;
    line-height: 1.6;
    white-space: nowrap;
  }

  .ui-tag--brand {
    background: var(--brand-soft);
    color: var(--brand-strong);
  }

  .ui-tag--default {
    background: var(--surface-sunken);
    color: var(--text-muted);
  }

  .ui-tag--warning {
    background: var(--warning-soft);
    color: var(--warning);
  }

  .ui-tag--success {
    background: var(--success-soft);
    color: var(--success-ink);
  }

  .ui-tag--danger {
    background: var(--danger-soft);
    color: var(--danger-ink);
  }
}
</style>
