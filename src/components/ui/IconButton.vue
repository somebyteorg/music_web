<script setup lang="ts">
/** 方角图标按钮：替代散落的 .icon-button / .tiny-play 用法。 */
withDefaults(
  defineProps<{
    label: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  {},
)
</script>

<template>
  <button class="icon-button" :aria-label="label" :type="type" :disabled="disabled">
    <slot />
  </button>
</template>
