<script setup lang="ts">
/**
 * 按钮。primary / secondary / sm 复用全局 .button 规则（src/features/uploads/** 尚未迁移，
 * 仍在使用同一套类名，因此样式暂时保持全局单一来源）；ghost / danger 是组件层新增变体，
 * 样式内联在本组件里，只引用 token。
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    as?: 'button' | 'a'
    type?: 'button' | 'submit' | 'reset'
    href?: string
    disabled?: boolean
    busy?: boolean
  }>(),
  { as: 'button', size: 'md' },
)
</script>

<template>
  <component
    :is="as"
    :class="['button', variant, size === 'sm' && 'small', busy && 'is-busy']"
    :type="as === 'button' ? type : undefined"
    :href="as === 'a' ? href : undefined"
    :disabled="as === 'button' ? disabled || busy : undefined"
    :aria-busy="busy ? 'true' : undefined"
    :aria-disabled="as === 'a' && (disabled || busy) ? 'true' : undefined"
  >
    <slot name="icon" />
    <slot />
  </component>
</template>

<style scoped>
.button.ghost {
  color: var(--text-soft);
}

.button.ghost:hover:not(:disabled) {
  background: var(--surface-muted);
  color: var(--brand-strong);
}

.button.danger {
  color: var(--danger);
}

.button.danger:hover:not(:disabled) {
  background: var(--danger-soft);
  color: var(--danger-ink);
}

.button.is-busy {
  opacity: 0.6;
}
</style>
