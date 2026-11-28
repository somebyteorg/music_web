<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'
import { qualities } from '@/utils/format'

/**
 * 播放器左端：封面 + 曲名/副标题（音质·编码，或"已暂停"）。
 * 收起态的尺寸差异也写在本组件里，用 :global 命中外壳的 .player.collapsed：
 * 收起状态在 store 上，子组件自己读，不在父子之间传 props。
 */
const player = usePlayerStore()
const queue = useQueueStore()

const displayItem = computed(() => {
  if (player.song) return player.song
  const entry = queue.current
  return entry
    ? { id: entry.songId, name: entry.name, cover_id: entry.coverId, image_url: entry.imageUrl }
    : undefined
})

const subtitle = computed(() => {
  if (player.file) return `${qualities[player.file.quality]} · ${player.file.codec.toUpperCase()}`
  return queue.current ? '已暂停' : ''
})
</script>

<template>
  <EntityCover :item="displayItem" />
  <div class="player-title">
    <strong>{{ displayItem?.name }}</strong><span>{{ subtitle }}</span>
  </div>
</template>

<style scoped>
@layer components {
  /* EntityCover 的根元素就是 .cover（子组件根节点带本组件的 scope id），宽度由这里决定。
     收起态不缩封面：拆分前那条 .collapsed .player > .cover 因为 .collapsed 与 .player
     是同一个元素而从未生效（实测收起时封面一直是 46px），这里保持同样的结果。 */
  .cover {
    width: 46px;
    flex-shrink: 0;
    transition: width var(--motion-morph);
  }
  .player-title {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 168px;
    min-width: 0;
  }
  .player-title strong {
    font-size: 14px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .player-title span {
    font-size: 11px;
    color: var(--text-muted);
  }
  :global(.player.collapsed .player-title) {
    flex: 1;
    width: auto;
  }
  @media (max-width: 760px) {
    .player-title {
      width: 120px;
    }
  }
  @media (max-width: 540px) {
    .player-title {
      flex: 1;
      width: 100px;
    }
  }
}
</style>
