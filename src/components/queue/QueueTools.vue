<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PlayModeIcon from '@/components/PlayModeIcon.vue'
import { playModeLabels, useQueueStore } from '@/stores/queue'

/** 队列面板头部（进度/来源/关闭）与工具条（播放模式/清空）。 */
const queue = useQueueStore()
</script>
<template>
  <header class="queue-head">
    <div>
      <h2>播放队列</h2>
      <p class="queue-source">
        <span>{{ queue.progress }}</span>
        <span v-if="queue.source" class="queue-from">· {{ queue.source }}</span>
      </p>
    </div>
    <IconButton label="关闭队列" title="关闭" @click="queue.open = false">
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="m6 6 12 12M6 18 18 6" />
      </svg>
    </IconButton>
  </header>
  <div class="queue-tools">
    <Button size="sm" variant="secondary" @click="queue.cycleMode()">
      <PlayModeIcon :mode="queue.mode" />{{ playModeLabels[queue.mode] }}
    </Button>
    <Button size="sm" variant="secondary" :disabled="!queue.length" @click="queue.clear()">
      清空
    </Button>
  </div>
</template>
<style scoped>
@layer components {
  .queue-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    padding: 0 10px 10px;
  }
  .queue-head h2 {
    margin: 0;
    font-size: 15px;
  }
  .queue-source {
    margin: 4px 0 0;
    color: var(--text-muted);
    font-size: 11px;
  }
  .queue-from {
    margin-left: 4px;
  }
  .queue-tools {
    display: flex;
    gap: 8px;
    padding: 0 10px 10px;
  }
  .queue-tools .button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    font-size: 12px;
  }
  .queue-tools :deep(.ui-icon) {
    width: 14px;
    height: 14px;
  }
}
</style>
