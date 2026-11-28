<script lang="ts" setup>
import NowPlayingLyrics from './NowPlayingLyrics.vue'
import NowPlayingQueue from './NowPlayingQueue.vue'

/**
 * 卡片右栏：歌词 / 播放队列两个面板。tab 由外壳（卡片第一行）持有，这里只按 tab 显示。
 * 两个面板都用 v-show 常驻：切到队列不会卸载歌词列表，已解析的数据不丢、也不重新请求。
 */
defineProps<{ tab: 'lyrics' | 'queue' }>()
</script>

<template>
  <div class="np-side">
    <div v-show="tab === 'lyrics'" class="np-pane">
      <NowPlayingLyrics />
    </div>
    <div v-show="tab === 'queue'" class="np-pane">
      <NowPlayingQueue />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .np-side {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    min-height: 0;
    height: 100%;
    justify-self: stretch;
  }
  .np-pane {
    display: flex;
    flex: 1;
    min-height: 0;
  }
}
</style>
