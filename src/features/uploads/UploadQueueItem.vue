<script lang="ts" setup>
import { computed } from 'vue'
import { useUploadsStore } from '@/stores/uploads'
import { bytes, duration, qualities } from '@/utils/format'
import { fileUrl } from '@/utils/file'
import { isUploadDone, TRANSMIT_STATES, UPLOAD_STATES as states, type UploadTask } from './model'
import UploadQueueItemActions from './UploadQueueItemActions.vue'

const props = defineProps<{ task: UploadTask; busy: boolean; selected: boolean }>()
const emit = defineEmits<{
  'toggle-selection': []
  'use-duplicate': []
  retry: [task: UploadTask]
  preview: [task: UploadTask, previewOnly: boolean]
  inspect: [task: UploadTask]
}>()
const uploads = useUploadsStore()
const done = computed(() => isUploadDone(props.task))
const coverUrl = computed(() => {
  const file = props.task.transfer.file
  const id = props.task.kind === 'cover' ? file?.id : file?.preview?.cover_id
  return id ? fileUrl(id) : uploads.localCover(props.task)
})
</script>
<template>
  <article class="upload-task">
    <label v-if="task.state === 'ready' && task.kind === 'audio'" class="task-select"
      ><input
        :aria-label="`选择 ${task.name}`"
        :checked="selected"
        type="checkbox"
        @change="emit('toggle-selection')"
    /></label>
    <button
      v-else-if="coverUrl"
      :aria-label="`预览 ${task.name}`"
      class="task-thumbnail"
      type="button"
      @click="emit('inspect', task)"
    >
      <img :src="coverUrl" alt="" loading="lazy" />
    </button>
    <span v-else :class="['task-icon', { done }]">{{
      done ? '✓' : task.kind === 'cover' ? '▣' : '♫'
    }}</span>
    <div class="task-body">
      <strong :title="task.relativePath">{{ task.name }}</strong>
      <p class="hint">
        {{ bytes(task.size)
        }}<span v-if="task.transfer.file?.quality && task.kind === 'audio'">
          · {{ qualities[task.transfer.file.quality] }}</span
        ><span v-if="task.relativePath !== task.name"> · {{ task.relativePath }}</span>
        <span v-if="task.metadata.duration"> · {{ duration(task.metadata.duration) }}</span
        ><span v-if="task.transfer.file?.preview?.lyrics.length">
          · {{ task.transfer.file.preview.lyrics.length }} 个歌词版本</span
        >
        <span v-if="task.metadata.targetSongId">
          · 加入
          <RouterLink :to="`/songs/${task.metadata.targetSongId}`" class="text-link">{{
            task.metadata.targetSongName || '目标歌曲'
          }}</RouterLink></span
        >
      </p>
      <div
        v-if="TRANSMIT_STATES.includes(task.state)"
        :aria-label="`${task.name} 上传进度`"
        :aria-valuenow="
          task.state === 'preparing'
            ? task.transfer.preparationProgress || 0
            : task.transfer.progress
        "
        aria-valuemax="100"
        aria-valuemin="0"
        class="progress-track"
        role="progressbar"
      >
        <span
          :style="{
            width: `${task.state === 'preparing' ? task.transfer.preparationProgress || 0 : task.transfer.progress}%`,
          }"
        ></span>
      </div>
      <p v-if="task.state === 'duplicate'" class="duplicate-note">
        {{
          uploads.duplicateFile(task)
            ? `已有相同文件：${uploads.duplicateFile(task)?.file_name}`
            : '本队列中已有相同文件，可等待处理完成后使用。'
        }}
        <RouterLink
          v-if="uploads.duplicateFile(task)?.song_id"
          :to="`/songs/${uploads.duplicateFile(task)?.song_id}`"
          class="text-link"
          >查看已有歌曲</RouterLink
        >
      </p>
      <p
        v-if="task.transfer.file?.preview?.warnings.length && task.state === 'ready'"
        class="task-warning"
      >
        {{ task.transfer.file.preview.warnings.join(' ') }}
      </p>
      <p v-if="task.error" class="error-text">{{ task.error }}</p>
    </div>
    <span :class="['task-state', task.state]"
      >{{ task.kind === 'cover' && task.state === 'ready' ? '图片已上传' : states[task.state]
      }}<span v-if="task.state === 'uploading'"> {{ task.transfer.progress }}%</span></span
    >
    <UploadQueueItemActions
      :busy="busy"
      :cover-url="coverUrl"
      :task="task"
      @inspect="emit('inspect', $event)"
      @preview="(task, previewOnly) => emit('preview', task, previewOnly)"
      @retry="emit('retry', $event)"
      @use-duplicate="emit('use-duplicate')"
    />
  </article>
</template>
<style scoped>
.task-thumbnail {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 5px;
  overflow: hidden;
  background: var(--surface-muted);
}
.task-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.upload-task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-top: 1px solid var(--line);
}
.task-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 30px;
  flex-shrink: 0;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 4px;
  font-size: 16px;
}
.task-icon.done {
  background: var(--success-soft);
  color: var(--success);
}
.task-body {
  min-width: 0;
  flex: 1;
}
.task-body strong {
  display: block;
  font-size: 13px;
  font-weight: 550;
  overflow-wrap: anywhere;
}
.task-body > .hint {
  margin-top: 2px;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.task-state {
  width: 82px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}
.task-state.ready,
.task-state.duplicate {
  color: var(--warning);
}
.task-state.published {
  color: var(--success);
}
.task-state.failed {
  color: var(--danger);
}
.progress-track {
  margin-top: 5px;
  height: 3px;
  max-width: 460px;
  overflow: hidden;
  border-radius: 2px;
  background: var(--brand-soft);
}
.progress-track > span {
  display: block;
  height: 100%;
  background: var(--brand);
  transition: width 0.2s;
}
.duplicate-note,
.task-warning {
  margin-top: 5px;
  color: var(--warning);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.task-select {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  min-height: 30px;
}
@media (max-width: 680px) {
  .upload-task {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr);
    gap: 4px 10px;
    padding: 10px;
  }
  .task-icon,
  .task-thumbnail,
  .task-select {
    grid-column: 1;
    grid-row: 1;
  }
  .task-thumbnail {
    width: 26px;
    height: 30px;
  }
  .task-body {
    grid-column: 2;
    grid-row: 1;
  }
  .task-state {
    grid-column: 2;
    grid-row: 2;
    width: auto;
  }
}
</style>
