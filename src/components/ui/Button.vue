<script setup lang="ts">
/**
 * 按钮。primary / secondary / sm 复用全局 .button 规则（样式保持全局单一来源）；
 * ghost / danger 是组件层新增变体，样式内联在本组件里，只引用 token。
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    /** label 用于「包裹隐藏 file input 的按钮」，页面里 class="button" 的 <label> 都是这个用法 */
    as?: 'button' | 'a' | 'label'
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
