<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import type { Entity } from '@/types/catalog'
import { useSongListContext } from './songListContext'

/** 一行的默认操作：收藏、编辑、上传音频、加入队列、下一首播放。 */
const props = defineProps<{ song: Entity }>()
const { props: listProps, favorite, isFavoriting, enqueue, playNext, edit } = useSongListContext()
</script>

<template>
  <IconButton
    :label="props.song.is_favorite ? `取消收藏 ${props.song.name}` : `收藏 ${props.song.name}`"
    :aria-pressed="!!props.song.is_favorite"
    :class="['follow', { active: props.song.is_favorite }]"
    :disabled="listProps.disabled || isFavoriting(props.song)"
    :title="props.song.is_favorite ? '取消收藏' : '收藏歌曲'"
    @click="favorite(props.song)"
  >
    <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
      <path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1Z" /></svg
  ></IconButton>
  <IconButton
    v-if="listProps.editable"
    :label="`编辑 ${props.song.name}`"
    :disabled="listProps.disabled"
    class="edit"
    title="编辑资料"
    @click="edit(props.song)"
  >
    ✎</IconButton
  ><RouterLink
    :aria-label="`为 ${props.song.name} 上传音频`"
    :to="`/uploads?song=${props.song.id}`"
    class="icon-button"
    title="上传音频"
    >↑</RouterLink
  ><IconButton
    :label="`把 ${props.song.name} 加入队列`"
    class="queue-action"
    title="加入队列"
    @click="enqueue(props.song)"
  >
    <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
      <path d="M4 6h11M4 11h11M4 16h7M18 9v8M14 13h8" /></svg
  ></IconButton>
  <IconButton
    :label="`下一首播放 ${props.song.name}`"
    class="queue-action"
    title="下一首播放"
    @click="playNext(props.song)"
  >
    <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
      <path d="M4 6h9M4 11h9M4 16h6M16 8v7M16 8l4 2.5-4 2.5" />
    </svg>
  </IconButton>
</template>

<style scoped>
.song-actions .icon-button {
  font-size: 17px;
}
.follow {
  color: var(--text-muted);
}
.follow.active {
  color: var(--brand-strong);
}
.follow.active .ui-icon {
  fill: var(--brand-soft);
}
@container (max-width: 620px) {
  .edit,
  .queue-action {
    display: none;
  }
}
@media (pointer: coarse) {
  .song-actions .icon-button {
    width: 32px;
    min-width: 32px;
    height: 36px;
  }
}
</style>
