<script lang="ts" setup>
import { useUploadsStore } from '@/stores/uploads'
import { bytes, duration, qualities } from '@/utils/format'
import {
  MAX_UPLOAD_CONCURRENCY,
  TRANSMIT_STATES,
  UPLOAD_STATES as states,
  type UploadTask,
} from './model'
import { useUploadQueue } from './useUploadQueue'

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
  changeConcurrency,
  inGroup,
  filters,
  visibleTasks,
  grouping,
  chosenTasks,
  canPause,
  canResume,
  toggleSelection,
  selectGroup,
  resumeAll,
  previewCover,
  retry,
  clearDone,
} = useUploadQueue()
</script>
<template>
  <section class="queue-section">
    <div v-if="uploads.tasks.length" aria-label="队列整体进度" class="queue-summary panel">
      <div class="summary-heading">
        <div>
          <span class="hint">文件传输</span
          ><strong>{{ uploads.stats.progress }}<small>%</small></strong
          ><span class="hint"
            >{{ bytes(uploads.stats.sent) }} / {{ bytes(uploads.stats.total) }}</span
          >
        </div>
        <div class="summary-speed">
          <strong>{{
            !uploads.stats.total
              ? '无需重复传输'
              : uploads.stats.speed
                ? `${bytes(uploads.stats.speed)}/s`
                : uploads.stats.uploading
                  ? '正在上传'
                  : uploads.stats.preparing
                    ? '正在校验文件'
                    : uploads.stats.sent >= uploads.stats.total
                      ? '传输已完成'
                      : '等待传输'
          }}</strong><span class="hint">{{
            uploads.stats.sent >= uploads.stats.total
              ? '解析、确认与入库状态见下方'
              : uploads.stats.remaining !== null
                ? `预计还需 ${duration(uploads.stats.remaining)}`
                : '剩余时间待估算'
          }}</span>
        </div>
      </div>
      <div
        :aria-valuenow="uploads.stats.progress"
        aria-label="整体文件传输进度"
        aria-valuemax="100"
        aria-valuemin="0"
        class="summary-progress"
        role="progressbar"
      >
        <span :style="{ width: `${uploads.stats.progress}%` }"></span>
      </div>
      <div class="summary-stages">
        <span :class="{ current: uploads.stats.preparing }"
          >校验 <b>{{ uploads.stats.preparing }}</b></span
        >
        <span :class="{ current: uploads.stats.transmitting }"
          >上传 <b>{{ uploads.stats.transmitting }}</b></span
        >
        <span :class="{ current: uploads.stats.processing }"
          >解析 <b>{{ uploads.stats.processing }}</b></span
        >
        <span :class="{ current: uploads.stats.ready }"
          >待确认 <b>{{ uploads.stats.ready }}</b></span
        >
        <span :class="{ current: uploads.stats.publishing }"
          >入库 <b>{{ uploads.stats.publishing }}</b></span
        >
        <span
          >已完成 <b>{{ uploads.stats.done }}</b></span
        >
      </div>
    </div>
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
          :disabled="!uploads.tasks.some((task) => inGroup(task, 'done'))"
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
    <div v-if="uploads.tasks.length" class="queue-bulk">
      <div class="button-group">
        <button
          :disabled="busy || !canPause"
          class="button small secondary"
          @click="run(() => uploads.pauseAll())"
        >
          全部暂停
        </button>
        <button :disabled="busy || !canResume" class="button small secondary" @click="resumeAll()">
          全部继续
        </button>
        <button
          :disabled="busy || !uploads.stats.failed"
          class="text-button"
          @click="resumeAll(true)"
        >
          重试失败 {{ uploads.stats.failed || '' }}
        </button>
        <button
          v-if="uploads.stats.duplicate"
          class="text-button"
          @click="
            uploads.tasks
              .filter((task) => task.state === 'duplicate')
              .forEach((task) => uploads.skip(task))
          "
        >
          跳过重复 {{ uploads.stats.duplicate }}
        </button>
      </div>
      <div class="queue-grouping">
        <span class="hint">分组</span
        ><button
          :aria-pressed="grouping.groupBy === 'folder'"
          :class="{ active: grouping.groupBy === 'folder' }"
          @click="grouping.groupBy = 'folder'"
        >
          文件夹</button
        ><button
          :aria-pressed="grouping.groupBy === 'album'"
          :class="{ active: grouping.groupBy === 'album' }"
          @click="grouping.groupBy = 'album'"
        >
          专辑
        </button>
      </div>
    </div>
    <div v-if="chosenTasks.length" class="queue-selection">
      <span>已选 {{ chosenTasks.length }} 份待确认音频</span>
      <div class="button-group">
        <button class="text-button" @click="selectedIds = []">取消选择</button
        ><button class="button small primary" @click="emit('organize', chosenTasks)">
          批量整理
        </button>
      </div>
    </div>
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
          <article v-for="task in group.tasks" :key="task.id" class="upload-task">
            <label v-if="task.state === 'ready' && task.kind === 'audio'" class="task-select"
              ><input
                :aria-label="`选择 ${task.name}`"
                :checked="selectedIds.includes(task.id)"
                type="checkbox"
                @change="toggleSelection(task)"
            /></label>
            <button
              v-else-if="previewCover(task)"
              :aria-label="`预览 ${task.name}`"
              class="task-thumbnail"
              type="button"
              @click="emit('inspect', task)"
            >
              <img :src="previewCover(task)" alt="" loading="lazy" />
            </button>
            <span v-else :class="['task-icon', { done: inGroup(task, 'done') }]">{{
              inGroup(task, 'done') ? '✓' : task.kind === 'cover' ? '▣' : '♫'
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
                :aria-valuenow="
                  task.state === 'preparing' ? task.preparationProgress || 0 : task.progress
                "
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
              <p
                v-if="task.file?.preview?.warnings.length && task.state === 'ready'"
                class="task-warning"
              >
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
                @click="retry(task)"
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
                  @click="run(() => uploads.useDuplicate(task))"
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
                v-if="task.kind === 'cover' && previewCover(task)"
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
.task-thumbnail {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 5px;
  overflow: hidden;
  background: var(--soft);
}
.task-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.queue-summary {
  padding: 18px 20px;
  margin-bottom: 18px;
}
.summary-heading,
.summary-heading > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.summary-heading {
  justify-content: space-between;
}
.summary-heading > div:first-child > strong {
  color: var(--purple-dark);
  font-size: 28px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.summary-heading small {
  margin-left: 2px;
  font-size: var(--font-base);
  font-weight: 500;
}
.summary-speed {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: var(--font-base);
  font-variant-numeric: tabular-nums;
}
.summary-progress {
  height: 6px;
  margin: 15px 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--lilac);
}
.summary-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--purple);
  transition: width 0.2s;
}
.summary-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  color: var(--muted);
  font-size: var(--font-sm);
}
.summary-stages b {
  margin-left: 4px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.summary-stages .current {
  color: var(--purple-dark);
}
.queue-bulk,
.queue-selection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.queue-bulk > .button-group {
  gap: 10px;
}
.queue-grouping {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--font-sm);
  margin-left: auto;
}
.queue-grouping > span {
  margin-right: 5px;
}
.queue-grouping button {
  padding: 5px 9px;
  border-radius: 5px;
  color: var(--muted);
}
.queue-grouping button.active {
  background: var(--lilac);
  color: var(--purple-dark);
}
.queue-selection {
  padding: 10px 12px;
  border: 1px solid #dfd4ef;
  border-radius: var(--radius-md);
  background: var(--lilac);
  color: var(--purple-dark);
  font-size: var(--font-sm);
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
  font-size: var(--font-base);
  font-weight: 550;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.upload-group-toggle small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: var(--font-xs);
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
.group-select,
.task-select {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 26px;
  min-height: 30px;
}
.duplicate-note,
.task-warning {
  margin-top: 5px;
  color: #91632b;
  font-size: var(--font-sm);
  overflow-wrap: anywhere;
}
.queue-section {
  margin-top: 16px;
}
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
  font-size: var(--font-sm);
  color: var(--muted);
}
.queue-filters > button.active {
  color: var(--purple-dark);
  background: var(--lilac);
  font-weight: 550;
}
.queue-filters > button > span {
  font-size: var(--font-xs);
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
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--muted);
  font-size: var(--font-sm);
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
  font-size: var(--font-base);
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
  font-size: var(--font-xs);
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
  border-radius: var(--radius-md);
  color: var(--muted);
  font-size: var(--font-sm);
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
  color: var(--purple);
  background: var(--lilac);
  border-radius: 4px;
  font-size: 16px;
}
.task-icon.done {
  background: #eaf5ee;
  color: var(--success);
}
.task-body {
  min-width: 0;
  flex: 1;
}
.task-body strong {
  display: block;
  font-size: var(--font-base);
  font-weight: 550;
  overflow-wrap: anywhere;
}
.task-body > .hint {
  margin-top: 2px;
  font-size: var(--font-xs);
  overflow-wrap: anywhere;
}
.task-state {
  width: 82px;
  flex-shrink: 0;
  color: var(--muted);
  font-size: var(--font-sm);
  white-space: nowrap;
}
.task-state.ready,
.task-state.duplicate {
  color: #93601d;
}
.task-state.published {
  color: var(--success);
}
.task-state.failed {
  color: var(--danger);
}
.task-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 150px;
  max-width: 230px;
}
.progress-track {
  margin-top: 5px;
  height: 3px;
  max-width: 460px;
  overflow: hidden;
  border-radius: 2px;
  background: #ebe5f5;
}
.progress-track > span {
  display: block;
  height: 100%;
  background: var(--purple);
  transition: width 0.2s;
}
@media (max-width: 680px) {
  .queue-summary {
    padding: 15px;
  }
  .summary-heading {
    align-items: center;
  }
  .summary-heading > div:first-child {
    gap: 6px 10px;
  }
  .summary-heading > div:first-child > .hint:last-child {
    flex-basis: 100%;
  }
  .summary-speed {
    font-size: var(--font-sm);
  }
  .summary-stages {
    gap: 8px 16px;
  }
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
  .task-actions {
    grid-column: 2;
    grid-row: 3;
    justify-content: flex-start;
    min-width: 0;
  }
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
    font-size: var(--font-xs);
  }
}
</style>
