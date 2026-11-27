<script setup lang="ts">
/** 表单字段：label + 控件插槽 + hint/error。 */
withDefaults(
  defineProps<{
    label?: string
    hint?: string
    error?: string
  }>(),
  {},
)
</script>

<template>
  <label class="ui-field">
    <span v-if="label">{{ label }}</span>
    <slot />
    <small v-if="error" class="ui-field__error">{{ error }}</small>
    <small v-else-if="hint" class="ui-field__hint">{{ hint }}</small>
  </label>
</template>

<style scoped>
.ui-field__hint {
  color: var(--text-muted);
  font-size: var(--font-sm);
  font-weight: 400;
  line-height: 1.6;
}

.ui-field__error {
  color: var(--danger);
  font-size: var(--font-sm);
  font-weight: 400;
}
</style>
