<script lang="ts" setup>
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'
import NowPlaying from './now-playing/NowPlaying.vue'
import PlayerActions from './player/PlayerActions.vue'
import PlayerSeek from './player/PlayerSeek.vue'
import PlayerTrack from './player/PlayerTrack.vue'
import PlayerTransport from './player/PlayerTransport.vue'
import QueuePanel from './QueuePanel.vue'

/**
 * 播放器外壳：只负责可见性、.player 外壳与收起/展开形变，外加全屏歌词预览的挂载点。
 * 内部四段各管各的：封面/曲目信息 → PlayerTrack，播放键 → PlayerTransport，
 * 进度/时间/音量 → PlayerSeek，循环/队列/收起/关闭 → PlayerActions。
 * 收起态是 store 里的全局状态，子组件自己读，不在这里做 props 转发。
 */
const player = usePlayerStore()
const queue = useQueueStore()

const visible = computed(() => player.available || !!queue.current)
</script>

<template>
  <aside
    v-if="visible"
    :class="['player', { collapsed: player.collapsed }]"
    aria-label="试听播放器"
  >
    <PlayerTrack />
    <PlayerTransport />
    <PlayerSeek />
    <PlayerActions />
  </aside>
  <QueuePanel />
  <NowPlaying />
</template>

<style scoped>
@layer components {
  .player {
    position: fixed;
    z-index: 45;
    left: calc(var(--sidebar-width) + 20px);
    right: 20px;
    bottom: var(--player-offset);
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: var(--player-height);
    padding: 14px 20px;
    background: var(--surface-glass-strong);
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: var(--shadow-player);
    backdrop-filter: blur(20px);
    /* 收起/展开全程只动可插值的长度属性（不再出现 left: auto / width: 撑开） */
    transition:
      left var(--motion-morph),
      right var(--motion-morph),
      bottom var(--motion-morph),
      padding var(--motion-morph),
      min-height var(--motion-morph),
      gap var(--motion-morph),
      border-radius var(--motion-morph),
      box-shadow var(--motion-morph);
  }
  .player.collapsed {
    /* 用长度代替 left:auto + width，浏览器才能在两端之间插值 */
    left: calc(100% - 432px);
    right: 12px;
    bottom: 12px;
    padding: 8px 12px;
    min-height: 54px;
    gap: 10px;
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: var(--shadow-player-collapsed);
  }
  @media (max-width: 760px) {
    .player {
      left: 16px;
      right: 16px;
      padding-inline: 14px;
    }
    /* 窄屏下小窗贴满左右 12px（与桌面 420px 宽等效的视觉密度） */
    .player.collapsed {
      left: 12px;
      right: 12px;
    }
  }
  @media (max-width: 540px) {
    .player {
      left: 10px;
      right: 10px;
      bottom: 10px;
      flex-wrap: wrap;
      gap: 7px;
    }
    /* 收起后回到单行小窗（进度条那行的 flex-basis 归零，随之收高） */
    .player.collapsed {
      flex-wrap: nowrap;
    }
  }
}
</style>
