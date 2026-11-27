<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore, type QueueEntry } from '@/stores/queue'
import { duration } from '@/utils/format'
import EntityCover from '@/components/EntityCover.vue'

/**
 * 队列里的一行：序号/播放条、封面、曲名、时长与移除按钮。
 * 样式（含触屏常显移除按钮的媒体查询）随元素留在本组件，scoped 才不会失效。
 */
const props = defineProps<{ entry: QueueEntry; index: number }>()

const queue = useQueueStore()
const player = usePlayerStore()

const current = computed(() => queue.current?.key === props.entry.key)
const total = computed(() => (props.entry.duration ? duration(props.entry.duration) : '—'))
const cover = computed(() => ({
  id: props.entry.songId,
  name: props.entry.name,
  cover_id: props.entry.coverId,
  image_url: props.entry.imageUrl,
}))

function play() {
  const entry = queue.jump(props.entry.key)
  if (entry) void player.playEntry(entry)
}

function remove() {
  const wasCurrent = queue.current?.key === props.entry.key
  queue.removeItem(props.entry.key)
  if (!wasCurrent) return
  if (queue.current) void player.playEntry(queue.current)
  else {
    player.close()
    queue.clear()
  }
}
</script>
<template>
  <li :class="['queue-row', { current, muted: !entry.playable }]">
    <button
      :aria-label="`播放 ${entry.name}`"
      :disabled="!entry.playable"
      class="queue-main"
      @click="play"
    >
      <span class="queue-index">
        <span v-if="current" aria-hidden="true" class="queue-bars"><i></i><i></i><i></i></span>
        <template v-else>{{ index + 1 }}</template>
      </span>
      <EntityCover :item="cover" />
      <span class="queue-text">
        <strong>{{ entry.name }}</strong>
        <small>{{ entry.artists }} · {{ entry.album }}</small>
      </span>
      <span class="queue-time">{{ entry.playable ? total : '缺音频' }}</span>
    </button>
    <IconButton class="queue-remove" label="从队列移除" title="从队列移除" @click="remove">
      <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
        <path d="M5 12h14" />
      </svg>
    </IconButton>
  </li>
</template>
<style scoped>
@layer components {
  .queue-row {
    display: flex;
    align-items: center;
    gap: 2px;
    border-radius: 10px;
  }
  .queue-row:hover {
    background: var(--surface-hover);
  }
  .queue-row.current {
    background: var(--brand-tint);
  }
  .queue-row.muted {
    opacity: 0.55;
  }
  .queue-main {
    display: grid;
    grid-template-columns: 22px 36px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    padding: 7px 6px;
    text-align: left;
  }
  .queue-index {
    color: var(--text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .queue-main > .cover {
    width: 36px;
  }
  .queue-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .queue-text strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 550;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .queue-text small {
    overflow: hidden;
    color: var(--text-muted);
    font-size: 11px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .queue-time {
    color: var(--text-muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .queue-remove {
    flex-shrink: 0;
    opacity: 0;
  }
  .queue-row:hover .queue-remove,
  .queue-remove:focus-visible {
    opacity: 1;
  }
  /* 触屏没有 hover：删除按钮常显，否则手机上无法移除曲目 */
  @media (pointer: coarse), (max-width: 760px) {
    .queue-remove {
      opacity: 1;
    }
  }
  .queue-bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;
  }
  .queue-bars i {
    width: 2px;
    height: 100%;
    background: var(--brand);
    animation: queue-bar 0.9s ease-in-out infinite;
  }
  .queue-bars i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .queue-bars i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes queue-bar {
    0%,
    100% {
      transform: scaleY(0.35);
    }
    50% {
      transform: scaleY(1);
    }
  }
}
</style>
