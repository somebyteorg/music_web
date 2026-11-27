<script lang="ts" setup>
import { provide } from 'vue'
import type { Entity } from '@/types/catalog'
import SongTable from './song-list/SongTable.vue'
import {
  createSongListController,
  songListContextKey,
  type SongListProps,
  type SongListRowActions,
} from './song-list/songListContext'

/**
 * 对外契约保持原样：页面只传 items / 选择 / 收藏 / 编辑，不加新 props。
 * 控制器在这里创建并提供给 song-list/ 下的表头、行与默认操作，
 * 行内状态（收藏中）与播放/入队动作只有这一份。
 */
const props = withDefaults(defineProps<SongListProps>(), { offset: 0, editable: false, label: '' })
const emit = defineEmits<{
  select: [id: string]
  'select-all': [selected: boolean]
  favorite: [id: string, value: boolean]
  edit: [song: Entity]
}>()
defineSlots<{ actions?: (props: SongListRowActions) => unknown }>()

provide(
  songListContextKey,
  createSongListController(props, {
    select: (id) => emit('select', id),
    selectAll: (selected) => emit('select-all', selected),
    favorite: (id, value) => emit('favorite', id, value),
    edit: (song) => emit('edit', song),
  }),
)
</script>

<template>
  <SongTable>
    <template v-if="$slots.actions" #actions="row">
      <slot name="actions" v-bind="row" />
    </template>
  </SongTable>
</template>
