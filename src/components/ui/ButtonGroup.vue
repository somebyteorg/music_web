<script setup lang="ts">
/**
 * 按钮组：flex 换行 + 8px 间距。替换页面里直接写的 .button-group 容器。
 */
</script>

<template>
  <div class="button-group">
    <slot />
  </div>
</template>

<style scoped>
@layer components {
  .button-group {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
