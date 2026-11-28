<script lang="ts" setup>
import Tabs from '@/components/ui/Tabs.vue'
import { ref } from 'vue'
import NowPlayingLyrics from './NowPlayingLyrics.vue'
import NowPlayingQueue from './NowPlayingQueue.vue'

/**
 * 预览页右栏：歌词 / 播放队列两个 tab（用 ui/Tabs，与详情页歌词面板同一套分段控件）。
 * 两个面板都用 v-show 常驻：切到队列不会卸载歌词列表，已解析的数据不丢、也不重新请求。
 */
const tab = ref<'lyrics' | 'queue'>('lyrics')
</script>

<template>
  <div class="np-side">
    <Tabs class="np-tabs" label="歌词与播放队列" variant="segmented">
      <button :class="{ active: tab === 'lyrics' }" type="button" @click="tab = 'lyrics'">
        歌词</button
      ><button :class="{ active: tab === 'queue' }" type="button" @click="tab = 'queue'">
        播放队列
      </button>
    </Tabs>
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
  .np-tabs {
    flex-shrink: 0;
    align-self: center;
    width: min(240px, 100%);
    margin-bottom: var(--space-3);
  }
  .np-pane {
    display: flex;
    flex: 1;
    min-height: 0;
  }
}
</style>
