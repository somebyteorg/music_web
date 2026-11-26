<script setup lang="ts">
import EmptyState from '@/components/ui/EmptyState.vue'
</script>
<template>
  <EmptyState panel symbol="♩" as="h1" title="页面不存在">
    请检查网址，或返回曲库。
    <template #actions>
      <RouterLink class="button primary" to="/">回到曲库</RouterLink>
    </template>
  </EmptyState>
</template>
