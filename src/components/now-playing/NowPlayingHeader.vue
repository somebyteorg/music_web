<script lang="ts" setup>
import Tabs from '@/components/ui/Tabs.vue'
import { usePlayerMeta } from '@/composables/usePlayerMeta'

/**
 * 卡片第一行：左「专辑名 · 歌手」，右「歌词 / 播放队列」tab（左右基线对齐）。
 * tab 状态由外壳持有（空态、面板切换都要用它），这里只负责显示与回传。
 */
defineProps<{ tab: 'lyrics' | 'queue' }>()
const emit = defineEmits<{ 'update:tab': [value: 'lyrics' | 'queue'] }>()

const { albumName, artist } = usePlayerMeta()
</script>

<template>
  <div class="np-header">
    <p class="np-header-meta">
      <span class="np-header-album">{{ albumName }}</span>
      <span v-if="artist" class="np-header-artist"> · {{ artist }}</span>
    </p>
    <Tabs class="np-header-tabs" label="歌词与播放队列" size="lg" variant="segmented">
      <button
        :class="{ active: tab === 'lyrics' }"
        type="button"
        @click="emit('update:tab', 'lyrics')"
      >
        歌词</button
      ><button
        :class="{ active: tab === 'queue' }"
        type="button"
        @click="emit('update:tab', 'queue')"
      >
        播放队列
      </button>
    </Tabs>
  </div>
</template>

<style scoped>
@layer components {
  .np-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-width: 0;
    /* 右上角的关闭按钮浮在卡片里，这一行给它留出 44px + 一点间距 */
    padding-inline-end: calc(44px + var(--space-2));
  }
  .np-header-meta {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-sm);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .np-header-album {
    color: var(--text);
    font-weight: 550;
  }
  .np-header-tabs {
    flex-shrink: 0;
    width: min(240px, 100%);
  }
  @media (max-width: 899px) {
    /* 窄屏一行放不下 240px 的 tab：收窄 tab、收紧间距，把宽度让给「专辑名 · 歌手」 */
    .np-header {
      gap: var(--space-2);
      padding-inline-end: calc(44px + var(--space-1));
    }
    .np-header-tabs {
      width: min(150px, 100%);
    }
  }
}
</style>
