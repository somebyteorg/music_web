<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { useUploadsStore } from '@/stores/uploads'
import { TRANSMIT_STATES, type UploadTask } from './model'

defineProps<{ task: UploadTask; busy: boolean; coverUrl: string }>()
const emit = defineEmits<{
  'use-duplicate': []
  retry: [task: UploadTask]
  preview: [task: UploadTask, previewOnly: boolean]
  inspect: [task: UploadTask]
}>()
const uploads = useUploadsStore()
</script>
<template>
  <div class="task-actions">
    <TextButton v-if="TRANSMIT_STATES.includes(task.state)" @click="uploads.pause(task)">
      暂停</TextButton
    ><TextButton
      v-if="
        task.state === 'failed' ||
        task.state === 'paused' ||
        (task.errorStage === 'publishing' && task.error)
      "
      :disabled="busy"
      @click="emit('retry', task)"
    >
      {{
        task.errorStage === 'publishing'
          ? '重试入库'
          : task.transfer.progress === 100
            ? '重新处理'
            : '继续'
      }}</TextButton
    ><TextButton
      v-if="task.state === 'failed' && !task.transfer.file"
      :disabled="busy"
      @click="uploads.restart(task)"
    >
      重新上传</TextButton
    ><template v-if="task.state === 'duplicate'"
      ><TextButton :disabled="busy || !uploads.duplicateFile(task)" @click="emit('use-duplicate')">
        使用已有文件</TextButton
      ><TextButton @click="uploads.skip(task)">跳过</TextButton></template
    ><Button
      v-if="task.state === 'ready' && task.kind === 'audio'"
      variant="primary"
      size="sm"
      @click="emit('preview', task, false)"
    >
      确认归属</Button
    ><TextButton v-if="task.kind === 'cover' && coverUrl" @click="emit('inspect', task)">
      预览图片</TextButton
    ><TextButton
      v-if="task.kind === 'audio' && task.transfer.file && task.state !== 'ready'"
      @click="emit('preview', task, true)"
    >
      预览</TextButton
    ><RouterLink
      v-if="task.metadata.songId"
      :to="`/songs/${task.metadata.songId}`"
      class="text-link"
      >查看歌曲</RouterLink
    ><button
      v-if="!['processing', 'publishing'].includes(task.state)"
      :aria-label="`移除任务 ${task.name}`"
      class="icon-button"
      @click="uploads.remove(task)"
    >
      ×
    </button>
  </div>
</template>
<style scoped>
.task-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 150px;
  max-width: 230px;
}
@media (max-width: 680px) {
  .task-actions {
    grid-column: 2;
    grid-row: 3;
    justify-content: flex-start;
    min-width: 0;
  }
}
</style>
