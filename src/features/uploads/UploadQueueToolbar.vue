<script lang="ts" setup>
import { useUploadsStore } from '@/stores/uploads'
import {
  isUploadDone,
  MAX_UPLOAD_CONCURRENCY,
  normalizeUploadConcurrency,
  type UploadTask,
} from './model'
import UploadQueueBulk from './UploadQueueBulk.vue'

defineProps<{
  busy: boolean
  filters: { value: string; label: string; count: number }[]
  canPause: boolean
  canResume: boolean
  chosen: UploadTask[]
}>()
const emit = defineEmits<{
  'pause-all': []
  'resume-all': [onlyFailed: boolean]
  organize: [tasks: UploadTask[]]
  'clear-selection': []
}>()
const taskQuery = defineModel<string>('taskQuery', { required: true })
const taskFilter = defineModel<string>('taskFilter', { required: true })
const groupBy = defineModel<'folder' | 'album'>('groupBy', { required: true })
const uploads = useUploadsStore()

function changeConcurrency(event: Event) {
  const input = event.target as HTMLInputElement
  uploads.concurrency = normalizeUploadConcurrency(input.valueAsNumber)
  input.value = String(uploads.concurrency)
}
async function clearDone() {
  for (const task of [...uploads.tasks]) if (isUploadDone(task)) await uploads.remove(task)
}
</script>
<template>
  <div class="filter-bar queue-tools">
    <div aria-label="上传状态" class="queue-filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        :aria-pressed="taskFilter === filter.value"
        :class="{ active: taskFilter === filter.value }"
        @click="taskFilter = filter.value"
      >
        {{ filter.label }}<span>{{ filter.count }}</span>
      </button>
    </div>
    <div class="queue-settings">
      <label :title="`最多同时上传 ${MAX_UPLOAD_CONCURRENCY} 个文件`" class="concurrency-input">
        <svg aria-hidden="true" class="concurrency-icon" fill="none" viewBox="0 0 20 20">
          <path d="M6 15V5m-3 3 3-3 3 3M14 15V5m-3 3 3-3 3 3" />
        </svg>
        <span>同时上传</span>
        <span class="concurrency-value">
          <input
            :max="MAX_UPLOAD_CONCURRENCY"
            :value="uploads.concurrency"
            aria-label="同时上传数量，最多 32"
            inputmode="numeric"
            min="1"
            step="1"
            type="number"
            @change="changeConcurrency"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <span aria-hidden="true" class="concurrency-limit">/ {{ MAX_UPLOAD_CONCURRENCY }}</span>
        </span> </label
      ><button
        :disabled="!uploads.tasks.some((task) => isUploadDone(task))"
        class="queue-clear"
        @click="clearDone"
      >
        <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
          <path
            d="M3.5 5.5h13m-9-2h5m-7.5 2 .8 10a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9l.8-10M8 8.5v5m4-5v5"
          />
        </svg>
        移除已完成任务
      </button>
    </div>
  </div>
  <div v-if="uploads.tasks.length" class="queue-search">
    <div class="search-field">
      <span aria-hidden="true">⌕</span
      ><input
        v-model="taskQuery"
        aria-label="搜索上传任务"
        placeholder="搜索文件名、路径、歌手或专辑"
      /><button
        v-if="taskQuery"
        aria-label="清空任务搜索"
        class="icon-button"
        @click="taskQuery = ''"
      >
        ×
      </button>
    </div>
    <p class="hint">刷新后重新选择原文件可续传；解析期间可以离开此页。</p>
  </div>
  <UploadQueueBulk
    v-model:groupBy="groupBy"
    :busy="busy"
    :can-pause="canPause"
    :can-resume="canResume"
    :chosen="chosen"
    @clear-selection="emit('clear-selection')"
    @organize="emit('organize', $event)"
    @pause-all="emit('pause-all')"
    @resume-all="emit('resume-all', $event)"
  />
</template>
<style scoped>
.queue-tools {
  justify-content: space-between;
  gap: 12px 16px;
}
.queue-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.queue-filters > button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 9px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--muted);
}
.queue-filters > button.active {
  color: var(--purple-dark);
  background: var(--lilac);
  font-weight: 550;
}
.queue-filters > button > span {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.queue-settings {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  margin-left: auto;
}
.concurrency-input {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  cursor: text;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.concurrency-input:hover {
  border-color: #c9bddf;
}
.concurrency-input:focus-within {
  border-color: #ab91d9;
  box-shadow: 0 0 0 3px #7654bc12;
}
.concurrency-icon,
.queue-clear svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.concurrency-value {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding-left: 7px;
  border-left: 1px solid var(--line);
}
.concurrency-input input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
  width: 30px;
  min-width: 0;
  height: 28px;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  outline: 0;
  background: transparent;
  box-shadow: none;
  color: var(--purple-dark);
  font-size: 13px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.concurrency-input input::-webkit-inner-spin-button,
.concurrency-input input::-webkit-outer-spin-button {
  margin: 0;
  -webkit-appearance: none;
}
.concurrency-limit {
  color: #99949f;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.queue-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.queue-clear:not(:disabled):hover {
  background: var(--lilac);
  color: var(--purple-dark);
}
.queue-search {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 10px;
}
@media (max-width: 680px) {
  .queue-settings {
    width: 100%;
    justify-content: space-between;
    margin-top: 2px;
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .concurrency-input,
  .queue-clear {
    min-height: 40px;
  }
  .concurrency-input input[type='number'] {
    font-size: 16px;
  }
  .queue-search > .hint {
    font-size: 11px;
  }
}
</style>
