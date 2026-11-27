<script setup lang="ts">
/** 表单字段：label + 控件插槽。提示/错误由使用方在字段外自行表达（见 .hint / .notice）。 */
defineProps<{ label?: string }>()
</script>

<template>
  <label class="ui-field">
    <span v-if="label">{{ label }}</span>
    <slot />
  </label>
</template>
