<script lang="ts" setup>
import type { UploadBatch } from './useUploadBatch'

defineProps<{ batch: UploadBatch }>()
const emit = defineEmits<{ close: [] }>()
</script>
<template>
  <button type="button" :disabled="batch.busy" class="button secondary" @click="emit('close')">
    取消
  </button>
  <button
    :disabled="batch.busy || !batch.valid || !batch.ready.length"
    class="button secondary"
    type="button"
    @click="batch.save"
  >
    保存整理草稿
  </button>
  <button
    :disabled="batch.busy || !batch.valid || !batch.ready.length"
    class="button primary"
    type="button"
    @click="batch.publish"
  >
    {{ batch.busy ? '正在处理…' : `确认加入 ${batch.ready.length} 份音频` }}
  </button>
</template>
