<script lang="ts" setup>
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { useScrollFade } from '@/composables/useScrollFade'
import { useQueueStore } from '@/stores/queue'
import QueueItem from './queue/QueueItem.vue'
import QueueTools from './queue/QueueTools.vue'

/**
 * 播放队列抽屉：只负责开关、定位、滚动区与空态；
 * 头部/工具条在 QueueTools，单行曲目（含触屏删除按钮）在 QueueItem。
 */
const queue = useQueueStore()
const list = useTemplateRef<HTMLOListElement>('list')
const { refresh: refreshFade } = useScrollFade(list)

// 队列增删 / 抽屉开合后重算滚动渐隐
watch([() => queue.items.length, () => queue.open], () => void refreshFade())

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && queue.open) queue.open = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
<template>
  <Teleport to="body">
    <button
      v-if="queue.open"
      aria-label="关闭播放队列"
      class="queue-backdrop"
      type="button"
      @click="queue.open = false"
    />
    <section v-if="queue.open" id="queue-panel" aria-label="播放队列" class="queue-drawer">
      <QueueTools />
      <ol v-if="queue.length" ref="list" class="queue-list scroll-fade">
        <QueueItem
          v-for="(entry, index) in queue.items"
          :key="entry.key"
          :entry="entry"
          :index="index"
        />
      </ol>
      <div v-else class="queue-blank">
        <span aria-hidden="true" class="queue-blank-symbol">♫</span>
        <p>队列还是空的</p>
        <small>在任意歌曲列表里点一首歌，整个列表就会成为播放队列。</small>
      </div>
    </section>
  </Teleport>
</template>
<style scoped>
@layer components {
  .queue-backdrop {
    position: fixed;
    /* 低于播放器（45）：点空白可关队列，但播放器仍可操作 */
    z-index: 40;
    inset: 0;
    padding: 0;
    background: var(--scrim-soft);
  }
  .queue-drawer {
    /* 高于播放器（45）：桌面右下角展开，移动端浮在播放器上方 */
    position: fixed;
    z-index: 46;
    right: 16px;
    bottom: 108px;
    display: flex;
    flex-direction: column;
    width: min(360px, calc(100vw - 32px));
    max-height: min(620px, calc(100vh - 160px));
    padding: 16px 8px 8px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: var(--shadow-lg);
  }
  .queue-list {
    margin: 0;
    padding: 0 4px 4px;
    overflow-y: auto;
    list-style: none;
  }
  .queue-blank {
    padding: 28px 18px 34px;
    color: var(--text-muted);
    text-align: center;
  }
  .queue-blank-symbol {
    color: var(--text-muted);
    font-size: 26px;
    line-height: 1.2;
  }
  .queue-blank p {
    margin: 6px 0 4px;
    color: var(--text-deep);
    font-size: 14px;
  }
  .queue-blank small {
    font-size: 11px;
    line-height: 1.6;
  }
  @media (max-width: 760px) {
    .queue-backdrop {
      background: var(--scrim-strong);
    }
    .queue-drawer {
      /* 留出播放器高度 + 安全区，避免最后几条曲目被压在播放器下面点不到 */
      right: 8px;
      bottom: calc(var(--player-height) + var(--player-offset) + env(safe-area-inset-bottom, 0px));
      left: 8px;
      width: auto;
      max-height: 62vh;
      padding-bottom: 10px;
      border-radius: 16px;
    }
  }
}
</style>
