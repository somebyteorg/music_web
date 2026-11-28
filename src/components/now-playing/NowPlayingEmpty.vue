<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import { usePlayerStore } from '@/stores/player'
import { useRouter } from 'vue-router'

/**
 * 卡片级歌词空态：整张卡片居中（不是右栏居中的小字），并给出去歌曲详情补歌词的出路。
 * 跳转前先关闭浮层 —— 否则详情页顶上还压着这层 dialog。
 */
const player = usePlayerStore()
const router = useRouter()

function goToSong() {
  const song = player.song
  player.closeNowPlaying()
  if (!song) return
  void router.push(`/songs/${song.id}`)
}
</script>

<template>
  <div class="np-empty">
    <p class="np-empty-title">这首歌还没有歌词</p>
    <p class="np-empty-hint">可以在歌曲详情页的「歌词」里添加</p>
    <Button class="np-empty-action" type="button" variant="secondary" @click="goToSong">
      去歌曲详情添加歌词
    </Button>
  </div>
</template>

<style scoped>
@layer components {
  .np-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: var(--space-6);
    text-align: center;
  }
  .np-empty-title {
    margin: 0;
    color: var(--text);
    font-size: var(--font-lg);
    font-weight: 600;
  }
  .np-empty-hint {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-sm);
  }
  .np-empty-action {
    margin-top: var(--space-3);
  }
}
</style>
