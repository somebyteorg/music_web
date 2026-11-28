<script lang="ts" setup>
import QueueItem from '@/components/queue/QueueItem.vue'
import { useScrollFade } from '@/composables/useScrollFade'
import { useQueueStore } from '@/stores/queue'
import { useTemplateRef, watch } from 'vue'

/**
 * 预览页「播放队列」面板：直接复用队列抽屉的行组件（QueueItem 自己读 store、自己算序号与时长），
 * 这里只补一层可滚动容器与空态。
 */
const queue = useQueueStore()
const list = useTemplateRef<HTMLOListElement>('list')
const { refresh: refreshFade } = useScrollFade(list)

// 队列增删后高度变了，ResizeObserver 感知不到内容变化，手动重算一次
watch(
  () => queue.items.length,
  () => void refreshFade(),
)
</script>

<template>
  <div class="np-queue">
    <ol v-if="queue.length" ref="list" class="np-queue-list scroll-fade">
      <QueueItem
        v-for="(entry, index) in queue.items"
        :key="entry.key"
        :entry="entry"
        :index="index"
      />
    </ol>
    <p v-else class="np-queue-blank">队列是空的</p>
  </div>
</template>

<style scoped>
@layer components {
  .np-queue {
    display: flex;
    flex-direction: column;
    flex: 1;
    width: 100%;
    min-height: 0;
  }
  .np-queue-list {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0 var(--space-1) var(--space-4);
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    scrollbar-gutter: stable;
  }
  .np-queue-blank {
    margin: auto;
    padding: var(--space-6);
    color: var(--text-muted);
    font-size: 14px;
    text-align: center;
  }
}
</style>
