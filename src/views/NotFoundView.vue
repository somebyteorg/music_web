<script setup lang="ts">
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
</script>
<template>
  <EmptyState panel symbol="♩" as="h1" title="页面不存在">
    请检查网址，或返回曲库。
    <template #actions>
      <Button to="/" variant="primary">回到曲库</Button>
    </template>
  </EmptyState>
</template>
