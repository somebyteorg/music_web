<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { playModeLabels, useQueueStore } from '@/stores/queue'
import { duration } from '@/utils/format'
import EntityCover from './EntityCover.vue'
import PlayModeIcon from './PlayModeIcon.vue'

const queue = useQueueStore()
const player = usePlayerStore()

const rows = computed(() =>
  queue.items.map((entry) => ({
    ...entry,
    total: entry.duration ? duration(entry.duration) : '—',
  })),
)

function coverOf(entry: {
  id: string
  name: string
  coverId: string | null
  imageUrl: string | null
}) {
  return { id: entry.id, name: entry.name, cover_id: entry.coverId, image_url: entry.imageUrl }
}

function play(key: string) {
  const entry = queue.jump(key)
  if (entry) void player.playEntry(entry)
}

function remove(key: string) {
  const wasCurrent = queue.current?.key === key
  queue.removeItem(key)
  if (!wasCurrent) return
  if (queue.current) void player.playEntry(queue.current)
  else {
    player.close()
    queue.clear()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && queue.open) queue.open = false
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="queue.open" class="queue-backdrop" @click.self="queue.open = false" />
    <section v-if="queue.open" id="queue-panel" aria-label="播放队列" class="queue-panel">
      <header class="queue-head">
        <div>
          <h2>播放队列</h2>
          <p class="queue-source">
            <span>{{ queue.progress }}</span>
            <span v-if="queue.source" class="queue-from">· {{ queue.source }}</span>
          </p>
        </div>
        <button aria-label="关闭队列" class="icon-button" title="关闭" @click="queue.open = false">
          <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </header>

      <div class="queue-tools">
        <button class="button secondary small" @click="queue.cycleMode()">
          <PlayModeIcon :mode="queue.mode" />{{ playModeLabels[queue.mode] }}
        </button>
        <button :disabled="!queue.length" class="button secondary small" @click="queue.clear()">
          清空
        </button>
      </div>

      <ol v-if="rows.length" class="queue-list">
        <li
          v-for="(entry, index) in rows"
          :key="entry.key"
          :class="[
            'queue-row',
            { current: queue.current?.key === entry.key, muted: !entry.playable },
          ]"
        >
          <button
            :aria-label="`播放 ${entry.name}`"
            :disabled="!entry.playable"
            class="queue-main"
            @click="play(entry.key)"
          >
            <span class="queue-index">
              <span v-if="queue.current?.key === entry.key" class="queue-bars" aria-hidden="true"
                ><i></i><i></i><i></i
              ></span>
              <template v-else>{{ index + 1 }}</template>
            </span>
            <EntityCover
              :item="
                coverOf({
                  id: entry.songId,
                  name: entry.name,
                  coverId: entry.coverId,
                  imageUrl: entry.imageUrl,
                })
              "
            />
            <span class="queue-text">
              <strong>{{ entry.name }}</strong>
              <small>{{ entry.artists }} · {{ entry.album }}</small>
            </span>
            <span class="queue-time">{{ entry.playable ? entry.total : '缺音频' }}</span>
          </button>
          <button
            aria-label="从队列移除"
            class="icon-button queue-remove"
            title="从队列移除"
            @click="remove(entry.key)"
          >
            <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
              <path d="M5 12h14" />
            </svg>
          </button>
        </li>
      </ol>

      <div v-else class="queue-empty">
        <span aria-hidden="true" class="empty-symbol">♫</span>
        <p>队列还是空的</p>
        <small>在任意歌曲列表里点一首歌，整个列表就会成为播放队列。</small>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.queue-backdrop {
  position: fixed;
  /* 低于播放器（45）：点空白可关队列，但播放器仍可操作 */
  z-index: 40;
  inset: 0;
  background: #1b162a0f;
}
.queue-panel {
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
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 12px 48px #2920351f;
}
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
  color: var(--muted);
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
.queue-list {
  margin: 0;
  padding: 0 4px 4px;
  overflow-y: auto;
  list-style: none;
}
.queue-row {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 10px;
}
.queue-row:hover {
  background: #faf9fd;
}
.queue-row.current {
  background: #f5f1fc;
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
  color: var(--muted);
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
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.queue-time {
  color: var(--muted);
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
  background: var(--purple);
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
.queue-empty {
  padding: 28px 18px 34px;
  color: var(--muted);
  text-align: center;
}
.queue-empty p {
  margin: 6px 0 4px;
  color: #2a2438;
  font-size: 14px;
}
.queue-empty small {
  font-size: 11px;
  line-height: 1.6;
}
@media (max-width: 760px) {
  .queue-backdrop {
    background: #1b162a26;
  }
  .queue-panel {
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
</style>
