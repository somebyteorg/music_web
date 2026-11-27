<script lang="ts" setup>
import { useSongListContext } from './songListContext'

/**
 * 表头：列名与全选。列宽与数据行共用 songGrid.css，
 * 窄屏下随列一起隐藏的列名也留在这里。
 */
const { props, allSelected, someSelected, toggleAll } = useSongListContext()
</script>

<template>
  <div class="song-label song-grid">
    <input
      v-if="props.selectable"
      :checked="allSelected"
      :disabled="props.disabled"
      :indeterminate="someSelected"
      aria-label="选择本页全部歌曲"
      type="checkbox"
      @change="toggleAll(($event.target as HTMLInputElement).checked)"
    />
    <span class="number-label">#</span><span>歌曲</span><span class="song-artists">歌手</span
    ><span class="song-album">专辑</span><span class="resource-label">音频资源</span
    ><span class="action-label">操作</span>
  </div>
</template>

<style scoped src="./songGrid.css"></style>
<style scoped>
@layer components {
  .song-label {
    min-height: 44px;
    background: var(--surface-muted);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    color: var(--text-muted);
    font-size: 12px;
  }
  .number-label {
    text-align: center;
  }
  .action-label {
    text-align: right;
    padding-right: 6px;
  }
  .song-artists,
  .song-album {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @container (max-width: 800px) {
    .song-artists {
      display: none;
    }
  }
  @container (max-width: 620px) {
    .song-album {
      display: none;
    }
  }
  @container (max-width: 460px) {
    .resource-label {
      display: none;
    }
  }
}
</style>
