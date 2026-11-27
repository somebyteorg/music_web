<script setup lang="ts">
/**
 * 方角图标按钮：替代散落的 .icon-button / .tiny-play 用法。
 *
 * 危险态由调用方传 class="danger"（例如操作对话框里「移除曲目」的 ×）：
 * 颜色在本组件的 <style scoped> 里加权定义，跟随 Button.vue 的 .button.danger 写法。
 */
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

<style scoped>
/* (0,3,0) 压过全局 .icon-button 的 --text-muted；hover 也一并锁住，
   否则 .icon-button:hover:not(:disabled) 的 (0,3,0) 会把 × 染成品牌色 */
.icon-button.danger,
.icon-button.danger:hover:not(:disabled) {
  color: var(--danger);
}
</style>
