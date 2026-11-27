<script lang="ts" setup>
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
    <button
      v-if="TRANSMIT_STATES.includes(task.state)"
      class="text-button"
      @click="uploads.pause(task)"
    >
      暂停</button
    ><button
      v-if="
        task.state === 'failed' ||
        task.state === 'paused' ||
        (task.errorStage === 'publishing' && task.error)
      "
      :disabled="busy"
      class="text-button"
      @click="emit('retry', task)"
    >
      {{
        task.errorStage === 'publishing'
          ? '重试入库'
          : task.transfer.progress === 100
            ? '重新处理'
            : '继续'
      }}</button
    ><button
      v-if="task.state === 'failed' && !task.transfer.file"
      :disabled="busy"
      class="text-button"
      @click="uploads.restart(task)"
    >
      重新上传</button
    ><template v-if="task.state === 'duplicate'"
      ><button
        :disabled="busy || !uploads.duplicateFile(task)"
        class="text-button"
        @click="emit('use-duplicate')"
      >
        使用已有文件</button
      ><button class="text-button" @click="uploads.skip(task)">跳过</button></template
    ><button
      v-if="task.state === 'ready' && task.kind === 'audio'"
      class="button small primary"
      @click="emit('preview', task, false)"
    >
      确认归属</button
    ><button
      v-if="task.kind === 'cover' && coverUrl"
      class="text-button"
      @click="emit('inspect', task)"
    >
      预览图片</button
    ><button
      v-if="task.kind === 'audio' && task.transfer.file && task.state !== 'ready'"
      class="text-button"
      @click="emit('preview', task, true)"
    >
      预览</button
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
