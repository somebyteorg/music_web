<script lang="ts" setup>
import { computed } from 'vue'
import { useUploadsStore } from '@/stores/uploads'
import { bytes, duration, qualities } from '@/utils/format'
import { fileUrl } from '@/utils/file'
import { isUploadDone, TRANSMIT_STATES, UPLOAD_STATES as states, type UploadTask } from './model'

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

function previewCover() {
  const id = props.task.kind === 'cover' ? props.task.file?.id : props.task.file?.preview?.cover_id
  return id ? fileUrl(id) : uploads.localCover(props.task)
}
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
      v-else-if="previewCover()"
      :aria-label="`预览 ${task.name}`"
      class="task-thumbnail"
      type="button"
      @click="emit('inspect', task)"
    >
      <img :src="previewCover()" alt="" loading="lazy" />
    </button>
    <span v-else :class="['task-icon', { done }]">{{
      done ? '✓' : task.kind === 'cover' ? '▣' : '♫'
    }}</span>
    <div class="task-body">
      <strong :title="task.relativePath">{{ task.name }}</strong>
      <p class="hint">
        {{ bytes(task.size)
        }}<span v-if="task.file?.quality && task.kind === 'audio'">
          · {{ qualities[task.file.quality] }}</span
        ><span v-if="task.relativePath !== task.name"> · {{ task.relativePath }}</span>
        <span v-if="task.duration"> · {{ duration(task.duration) }}</span
        ><span v-if="task.file?.preview?.lyrics.length">
          · {{ task.file.preview.lyrics.length }} 个歌词版本</span
        >
        <span v-if="task.targetSongId">
          · 加入
          <RouterLink :to="`/songs/${task.targetSongId}`" class="text-link">{{
            task.targetSongName || '目标歌曲'
          }}</RouterLink></span
        >
      </p>
      <div
        v-if="TRANSMIT_STATES.includes(task.state)"
        :aria-label="`${task.name} 上传进度`"
        :aria-valuenow="task.state === 'preparing' ? task.preparationProgress || 0 : task.progress"
        aria-valuemax="100"
        aria-valuemin="0"
        class="progress-track"
        role="progressbar"
      >
        <span
          :style="{
            width: `${task.state === 'preparing' ? task.preparationProgress || 0 : task.progress}%`,
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
      <p v-if="task.file?.preview?.warnings.length && task.state === 'ready'" class="task-warning">
        {{ task.file.preview.warnings.join(' ') }}
      </p>
      <p v-if="task.error" class="error-text">{{ task.error }}</p>
    </div>
    <span :class="['task-state', task.state]"
      >{{
        task.kind === 'cover' && task.state === 'ready' ? '图片已上传' : states[task.state]
      }}<span v-if="task.state === 'uploading'"> {{ task.progress }}%</span></span
    >
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
            : task.progress === 100
              ? '重新处理'
              : '继续'
        }}</button
      ><button
        v-if="task.state === 'failed' && !task.file"
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
        v-if="task.kind === 'cover' && previewCover()"
        class="text-button"
        @click="emit('inspect', task)"
      >
        预览图片</button
      ><button
        v-if="task.kind === 'audio' && task.file && task.state !== 'ready'"
        class="text-button"
        @click="emit('preview', task, true)"
      >
        预览</button
      ><RouterLink v-if="task.songId" :to="`/songs/${task.songId}`" class="text-link"
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
  </article>
</template>
<style scoped>
.task-thumbnail { width: 44px; height: 44px; flex-shrink: 0; border-radius: 5px; overflow: hidden; background: var(--soft); }
.task-thumbnail img { width: 100%; height: 100%; object-fit: contain; }
.upload-task { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-top: 1px solid var(--line); }
.task-icon { display: grid; place-items: center; width: 26px; height: 30px; flex-shrink: 0; color: var(--purple); background: var(--lilac); border-radius: 4px; font-size: 16px; }
.task-icon.done { background: #eaf5ee; color: var(--success); }
.task-body { min-width: 0; flex: 1; }
.task-body strong { display: block; font-size: 13px; font-weight: 550; overflow-wrap: anywhere; }
.task-body > .hint { margin-top: 2px; font-size: 11px; overflow-wrap: anywhere; }
.task-state { width: 82px; flex-shrink: 0; color: var(--muted); font-size: 12px; white-space: nowrap; }
.task-state.ready, .task-state.duplicate { color: #93601d; }
.task-state.published { color: var(--success); }
.task-state.failed { color: var(--danger); }
.task-actions { display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 150px; max-width: 230px; }
.progress-track { margin-top: 5px; height: 3px; max-width: 460px; overflow: hidden; border-radius: 2px; background: #ebe5f5; }
.progress-track > span { display: block; height: 100%; background: var(--purple); transition: width 0.2s; }
.duplicate-note, .task-warning { margin-top: 5px; color: #91632b; font-size: 12px; overflow-wrap: anywhere; }
.task-select { display: grid; place-items: center; flex-shrink: 0; width: 26px; min-height: 30px; }
@media (max-width: 680px) {
  .upload-task { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 4px 10px; padding: 10px; }
  .task-icon, .task-thumbnail, .task-select { grid-column: 1; grid-row: 1; }
  .task-thumbnail { width: 26px; height: 30px; }
  .task-body { grid-column: 2; grid-row: 1; }
  .task-state { grid-column: 2; grid-row: 2; width: auto; }
  .task-actions { grid-column: 2; grid-row: 3; justify-content: flex-start; min-width: 0; }
}
</style>
