<script lang="ts" setup>
import Chip from '@/components/ui/Chip.vue'
import IconButton from '@/components/ui/IconButton.vue'
import TextButton from '@/components/ui/TextButton.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import { catalogLabels as labels, qualityOptions, sortOptions } from '@/features/catalog/config'
import { useCatalogContext } from './catalogContext'

/**
 * 查询工具栏：搜索、排序、筛选、显示方式。
 * 只改变查询条件（URL 即真相，写回都在 useCatalog 里），不持有列表数据。
 */
const { catalog, actions } = useCatalogContext()
const {
  type,
  q,
  sort,
  quality,
  library,
  favorites,
  missing,
  mine,
  filtered,
  total,
  loaded,
  busy,
  reset,
} = catalog
const { libraries, layout } = actions
</script>

<template>
  <div :aria-label="`筛选${labels[type]}`" class="filter-bar" role="search">
    <div class="search-field">
      <span aria-hidden="true">⌕</span>
      <input
        v-model="q"
        :aria-label="`搜索${labels[type]}名称`"
        :placeholder="`搜索${labels[type]}名称`"
        maxlength="100"
      />
      <IconButton label="清空搜索" v-if="q" @click="q = ''">×</IconButton>
    </div>
    <BaseSelect
      v-if="['songs', 'albums'].includes(type)"
      v-model="library"
      :disabled="libraries.busy"
      :options="[{ value: '', label: '全部媒体库' }, ...libraries.options]"
      label="按媒体库筛选"
    />
    <BaseSelect
      v-if="type !== 'playlists'"
      v-model="sort"
      :options="sortOptions"
      label="排列方式"
    />
    <BaseSelect
      v-if="type === 'songs'"
      v-model="quality"
      :options="qualityOptions"
      label="音质筛选"
    />
    <Chip
      v-if="type === 'songs'"
      :aria-pressed="favorites"
      :selected="favorites"
      title="只看已收藏的歌曲"
      @click="favorites = !favorites"
    >
      已收藏
    </Chip>
    <Chip
      v-if="type === 'songs'"
      :aria-pressed="missing"
      :selected="missing"
      @click="missing = !missing"
    >
      缺少音频
    </Chip>
    <Chip v-if="type === 'playlists'" :aria-pressed="mine" :selected="mine" @click="mine = !mine">
      我参与的
    </Chip>
    <TextButton v-if="filtered" @click="reset">重置</TextButton>
    <span v-if="loaded || busy" class="filter-count" role="status">{{
      busy ? '正在更新…' : `共 ${total.toLocaleString()} 条`
    }}</span>
    <div v-if="type !== 'songs'" aria-label="显示方式" class="view-toggle">
      <button
        :aria-pressed="layout === 'list'"
        :class="{ active: layout === 'list' }"
        @click="layout = 'list'"
      >
        列表</button
      ><button
        :aria-pressed="layout === 'grid'"
        :class="{ active: layout === 'grid' }"
        @click="layout = 'grid'"
      >
        封面
      </button>
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .view-toggle {
    display: flex;
    padding: 3px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
  }
  .view-toggle button {
    min-height: 32px;
    padding: 6px 11px;
    border-radius: 5px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .view-toggle .active {
    color: var(--brand-strong);
    background: var(--brand-soft);
  }
}
</style>
