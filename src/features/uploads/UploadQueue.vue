<script lang="ts" setup>
import { useUploadsStore } from '@/stores/uploads'
import { bytes } from '@/utils/format'
import type { UploadTask } from './model'
import { useUploadQueue } from './useUploadQueue'
import UploadQueueItem from './UploadQueueItem.vue'
import UploadQueueSummary from './UploadQueueSummary.vue'
import UploadQueueToolbar from './UploadQueueToolbar.vue'

defineProps<{ organizing: boolean }>()
const emit = defineEmits<{
  organize: [tasks: UploadTask[]]
  preview: [task: UploadTask, previewOnly: boolean]
  inspect: [task: UploadTask]
}>()
const uploads = useUploadsStore()
const {
  busy,
  run,
  taskQuery,
  selectedIds,
  taskFilter,
  filters,
  visibleTasks,
  grouping,
  chosenTasks,
  canPause,
  canResume,
  toggleSelection,
  selectGroup,
  resumeAll,
  retry,
} = useUploadQueue()
</script>
<template>
  <section class="queue-section">
    <UploadQueueSummary />
    <UploadQueueToolbar
      v-model:groupBy="grouping.groupBy"
      v-model:taskFilter="taskFilter"
      v-model:taskQuery="taskQuery"
      :busy="busy"
      :can-pause="canPause"
      :can-resume="canResume"
      :chosen="chosenTasks"
      :filters="filters"
      @clear-selection="selectedIds = []"
      @organize="emit('organize', $event)"
      @pause-all="run(() => uploads.pauseAll())"
      @resume-all="resumeAll"
    />
    <div v-if="visibleTasks.length" class="upload-groups">
      <section v-for="group in grouping.groups" :key="group.key" class="upload-queue panel">
        <div class="upload-group-heading">
          <label v-if="group.ready.length" class="group-select"
            ><input
              :aria-label="`选择 ${group.name} 的待确认音频`"
              :checked="group.ready.every((task) => selectedIds.includes(task.id))"
              type="checkbox"
              @change="selectGroup(group.tasks)"
          /></label>
          <button
            :aria-expanded="!grouping.collapsed[group.key]"
            class="upload-group-toggle"
            @click="grouping.toggle(group.key)"
          >
            <span :class="{ collapsed: grouping.collapsed[group.key] }" class="group-chevron"
              >⌄</span
            >
            <div>
              <strong>{{ group.name }}</strong><small
                >{{ group.subtitle }}{{ group.subtitle ? ' · ' : ''
                }}{{ group.tasks.length }} 个文件 · {{ bytes(group.total) }} · 已完成
                {{ group.done }}</small
              >
            </div>
          </button>
          <button
            v-if="group.ready.length"
            :disabled="organizing"
            class="button small secondary"
            @click="emit('organize', group.ready)"
          >
            整理 {{ group.ready.length }} 份音频
          </button>
        </div>
        <template v-if="!grouping.collapsed[group.key]">
          <UploadQueueItem
            v-for="task in group.tasks"
            :key="task.id"
            :busy="busy"
            :selected="selectedIds.includes(task.id)"
            :task="task"
            @inspect="emit('inspect', $event)"
            @preview="(task, previewOnly) => emit('preview', task, previewOnly)"
            @retry="retry"
            @toggle-selection="toggleSelection(task)"
            @use-duplicate="run(() => uploads.useDuplicate(task))"
          />
        </template>
      </section>
    </div>
    <div v-else class="empty panel compact">
      <h3>{{ uploads.tasks.length ? '没有符合条件的任务' : '暂无上传任务' }}</h3>
      <p>
        {{
          uploads.tasks.length
            ? '选择其他状态或修改搜索关键词。'
            : '添加文件后，在这里查看进度并确认歌曲归属。'
        }}
      </p>
    </div>
  </section>
</template>
<style scoped>
.queue-section {
  margin-top: 16px;
}
.upload-groups {
  display: grid;
  gap: 12px;
}
.upload-queue {
  overflow: hidden;
}
.upload-group-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--soft);
  border-radius: 11px 11px 0 0;
}
.upload-group-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  text-align: left;
}
.upload-group-toggle > div {
  min-width: 0;
}
.upload-group-toggle strong {
  display: block;
  font-size: 13px;
  font-weight: 550;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.upload-group-toggle small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 11px;
}
.group-chevron {
  width: 14px;
  flex-shrink: 0;
  color: var(--muted);
  font-size: 18px;
  transition: transform 0.15s;
}
.group-chevron.collapsed {
  transform: rotate(-90deg);
}
.group-select {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  min-height: 30px;
}
@media (max-width: 680px) {
  .upload-group-heading {
    padding: 10px;
    gap: 6px;
  }
  .upload-group-toggle {
    gap: 4px;
  }
  .upload-group-toggle small {
    font-size: 10px;
  }
}
</style>
