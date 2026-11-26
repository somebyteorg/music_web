<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import type { UploadBatch } from './useUploadBatch'

defineProps<{ batch: UploadBatch }>()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <Button type="button" :disabled="batch.busy" variant="secondary" @click="emit('close')">
    取消
  </Button>
  <Button
    :disabled="batch.busy || !batch.valid || !batch.ready.length"
    variant="secondary"
    type="button"
    @click="batch.save"
  >
    保存整理草稿
  </Button>
  <Button
    :disabled="batch.busy || !batch.valid || !batch.ready.length"
    variant="primary"
    type="button"
    @click="batch.publish"
  >
    {{ batch.busy ? '正在处理…' : `确认加入 ${batch.ready.length} 份音频` }}
  </Button>
</template>
