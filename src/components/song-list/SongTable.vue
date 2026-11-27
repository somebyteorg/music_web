<script lang="ts" setup>
import SongHeader from './SongHeader.vue'
import SongRow from './SongRow.vue'
import { useSongListContext, type SongListRowActions } from './songListContext'

/**
 * 表格容器：根节点、表头、行循环与 #actions 透传。
 * 列宽在 songGrid.css 里由表头与行共用，这里不重复写。
 */
defineSlots<{ actions?: (props: SongListRowActions) => unknown }>()
const { props, rowKey } = useSongListContext()
</script>

<template>
  <div :class="['song-list', { selectable: props.selectable }]">
    <SongHeader />
    <SongRow v-for="(song, index) in props.items" :key="rowKey(song)" :index="index" :song="song">
      <template v-if="$slots.actions" #actions="row">
        <slot name="actions" v-bind="row" />
      </template>
    </SongRow>
  </div>
</template>

<style scoped>
.song-list {
  container-type: inline-size;
}
</style>
