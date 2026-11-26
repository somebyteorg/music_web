<script lang="ts" setup>
import { useUploadsStore } from '@/stores/uploads'
import type { UploadTask } from './model'

defineProps<{
  busy: boolean
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
const groupBy = defineModel<'folder' | 'album'>('groupBy', { required: true })
const uploads = useUploadsStore()

function skipDuplicates() {
  uploads.tasks.filter((task) => task.state === 'duplicate').forEach((task) => uploads.skip(task))
}
</script>
<template>
  <div v-if="uploads.tasks.length" class="queue-bulk">
    <div class="button-group">
      <button
        :disabled="busy || !canPause"
        class="button small secondary"
        @click="emit('pause-all')"
      >
        全部暂停
      </button>
      <button
        :disabled="busy || !canResume"
        class="button small secondary"
        @click="emit('resume-all', false)"
      >
        全部继续
      </button>
      <button
        :disabled="busy || !uploads.stats.failed"
        class="text-button"
        @click="emit('resume-all', true)"
      >
        重试失败 {{ uploads.stats.failed || '' }}
      </button>
      <button v-if="uploads.stats.duplicate" class="text-button" @click="skipDuplicates">
        跳过重复 {{ uploads.stats.duplicate }}
      </button>
    </div>
    <div class="queue-grouping">
      <span class="hint">分组</span
      ><button
        :aria-pressed="groupBy === 'folder'"
        :class="{ active: groupBy === 'folder' }"
        @click="groupBy = 'folder'"
      >
        文件夹</button
      ><button
        :aria-pressed="groupBy === 'album'"
        :class="{ active: groupBy === 'album' }"
        @click="groupBy = 'album'"
      >
        专辑
      </button>
    </div>
  </div>
  <div v-if="chosen.length" class="queue-selection">
    <span>已选 {{ chosen.length }} 份待确认音频</span>
    <div class="button-group">
      <button class="text-button" @click="emit('clear-selection')">取消选择</button
      ><button class="button small primary" @click="emit('organize', chosen)">批量整理</button>
    </div>
  </div>
</template>
<style scoped>
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
  font-size: 12px;
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
  border-radius: 8px;
  background: var(--lilac);
  color: var(--purple-dark);
  font-size: 12px;
}
</style>
