<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import ButtonGroup from '@/components/ui/ButtonGroup.vue'
import TextButton from '@/components/ui/TextButton.vue'
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
    <ButtonGroup>
      <Button
        :disabled="busy || !canPause"
        variant="secondary"
        size="sm"
        @click="emit('pause-all')"
      >
        全部暂停
      </Button>
      <Button
        :disabled="busy || !canResume"
        variant="secondary"
        size="sm"
        @click="emit('resume-all', false)"
      >
        全部继续
      </Button>
      <TextButton :disabled="busy || !uploads.stats.failed" @click="emit('resume-all', true)">
        重试失败 {{ uploads.stats.failed || '' }}
      </TextButton>
      <TextButton v-if="uploads.stats.duplicate" @click="skipDuplicates">
        跳过重复 {{ uploads.stats.duplicate }}
      </TextButton>
    </ButtonGroup>
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
    <ButtonGroup>
      <TextButton @click="emit('clear-selection')">取消选择</TextButton
      ><Button variant="primary" size="sm" @click="emit('organize', chosen)">批量整理</Button>
    </ButtonGroup>
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
  color: var(--text-muted);
}
.queue-grouping button.active {
  background: var(--brand-soft);
  color: var(--brand-strong);
}
.queue-selection {
  padding: 10px 12px;
  border: 1px solid var(--brand-line-soft);
  border-radius: 8px;
  background: var(--brand-soft);
  color: var(--brand-strong);
  font-size: 12px;
}
</style>
