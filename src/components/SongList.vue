<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { Entity } from '@/types/catalog'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'
import api from '@/utils/ky'
import { notify, report } from '@/composables/useFeedback'
import EntityCover from './EntityCover.vue'

const props = withDefaults(
  defineProps<{
    items: Entity[]
    selectable?: boolean
    selected?: string[]
    offset?: number
    disabled?: boolean
    editable?: boolean
    trackNumbers?: boolean
    albumContextId?: string
    label?: string
  }>(),
  { offset: 0, editable: false, label: '' },
)
const emit = defineEmits<{
  select: [id: string]
  'select-all': [selected: boolean]
  favorite: [id: string, value: boolean]
  edit: [song: Entity]
}>()
const player = usePlayerStore()
const queue = useQueueStore()
const favoriting = ref(new Set<string>())
const allSelected = computed(
  () =>
    props.items.length > 0 && props.items.every((song) => props.selected?.includes(rowKey(song))),
)
const someSelected = computed(
  () => !allSelected.value && props.items.some((song) => props.selected?.includes(rowKey(song))),
)
function rowKey(song: Entity) {
  return song.entry_id || song.id
}
function hasAudio(song: Entity) {
  return song.available !== false && (song.files_count ?? song.files?.length ?? 0) > 0
}
function position(song: Entity) {
  return song.albums?.find((album) => album.id === props.albumContextId)?.pivot
}
function artistNames(song: Entity) {
  return song.artists?.map((artist) => artist.name).join(' / ') || '未填写歌手'
}
async function favorite(song: Entity) {
  if (favoriting.value.has(song.id)) return
  favoriting.value.add(song.id)
  const value = !song.is_favorite
  try {
    await api.put(`songs/${song.id}/favorite`, { json: { favorite: value } })
    emit('favorite', song.id, value)
  } catch (e) {
    report(e)
  } finally {
    favoriting.value.delete(song.id)
  }
}
function play(song: Entity, index: number) {
  if (queue.isCurrent(song.id)) {
    void player.toggle()
    return
  }
  // 点哪一首，就把当前这份列表整体变成播放队列（来自别的列表时给一句提示，不提供撤销）
  const replaced = queue.length > 0 && queue.source !== props.label
  void player.playList(props.items, index, props.label)
  if (replaced) notify(`队列已切换为「${props.label || '当前列表'}」· ${props.items.length} 首`)
}
function enqueue(song: Entity) {
  queue.append([song])
  notify(`已加入队列：${song.name}`)
}
function playNext(song: Entity) {
  queue.insertNext([song])
  notify(`下一首播放：${song.name}`)
}
</script>

<template>
  <div :class="['song-list', { selectable }]">
    <div class="song-label song-grid">
      <input
        v-if="selectable"
        :checked="allSelected"
        :disabled="disabled"
        :indeterminate="someSelected"
        aria-label="选择本页全部歌曲"
        type="checkbox"
        @change="emit('select-all', ($event.target as HTMLInputElement).checked)"
      />
      <span class="number-label">#</span><span>歌曲</span><span class="song-artists">歌手</span
      ><span class="song-album">专辑</span><span class="resource-label">音频资源</span
      ><span class="action-label">操作</span>
    </div>
    <article
      v-for="(song, index) in items"
      :key="rowKey(song)"
      :class="[
        'song-row',
        'song-grid',
        { playing: queue.isCurrent(song.id), selected: selected?.includes(rowKey(song)) },
      ]"
    >
      <input
        v-if="selectable"
        :aria-label="`选择 ${song.name}`"
        :checked="selected?.includes(rowKey(song))"
        :disabled="disabled"
        type="checkbox"
        @change="emit('select', rowKey(song))"
      />
      <button
        :aria-label="`${player.song?.id === song.id && player.playing ? '暂停' : '试听'} ${song.name}`"
        :disabled="!hasAudio(song)"
        :title="
          trackNumbers
            ? `第 ${position(song)?.disc_number} 碟第 ${position(song)?.track_number} 首`
            : player.song?.id === song.id && player.playing
              ? '暂停'
              : '试听'
        "
        class="song-play"
        @click="play(song, index)"
      >
        <span class="song-index">{{
          trackNumbers
            ? `${position(song)?.disc_number}.${String(position(song)?.track_number).padStart(2, '0')}`
            : offset + index + 1
        }}</span><svg
          aria-hidden="true"
          class="ui-icon playback-icon play-icon"
          viewBox="0 0 24 24"
        >
          <path
            :d="
              player.song?.id === song.id && player.playing
                ? 'M6 5h4v14H6zM14 5h4v14h-4z'
                : 'm8 5 11 7-11 7Z'
            "
          />
        </svg>
      </button>
      <div class="song-title">
        <EntityCover :item="song.cover_id || song.image_url ? song : song.albums?.[0] || song" />
        <div class="song-info">
          <RouterLink :title="song.name" :to="`/songs/${song.id}`" class="song-name"
            >{{ song.name
            }}<small v-if="song.recording_version">{{ song.recording_version }}</small></RouterLink
          >
          <div class="mobile-meta">
            <span class="mobile-artist">{{ artistNames(song) }}</span><RouterLink
              :to="hasAudio(song) ? `/songs/${song.id}` : `/uploads?song=${song.id}`"
              class="mobile-resource"
              ><span :class="['badge', { warning: !hasAudio(song), quiet: hasAudio(song) }]">{{
                hasAudio(song) ? `${song.files_count ?? song.files?.length} 份音频` : '缺少音频'
              }}</span></RouterLink
            >
          </div>
        </div>
      </div>
      <div :title="artistNames(song)" class="song-artists">
        <template v-if="song.artists?.length"
          ><RouterLink
            v-for="(artist, artistIndex) in song.artists"
            :key="artist.id"
            :to="`/artists/${artist.id}`"
            >{{ artistIndex ? ' / ' : '' }}{{ artist.name }}</RouterLink
          ></template
        ><span v-else>未填写</span>
      </div>
      <div class="song-album">
        <template v-if="song.albums?.length"
          ><RouterLink
            v-for="(album, i) in song.albums"
            :key="album.id"
            :title="album.name"
            :to="`/albums/${album.id}`"
            >{{ i ? ' / ' : '' }}{{ album.name }}</RouterLink
          ></template
        ><span v-else>单曲</span
        ><small v-if="song.library" class="song-library">{{ song.library.name }}</small>
      </div>
      <RouterLink
        :to="hasAudio(song) ? `/songs/${song.id}` : `/uploads?song=${song.id}`"
        class="song-resources"
        ><span :class="['badge', { warning: !hasAudio(song), quiet: hasAudio(song) }]">{{
          hasAudio(song) ? `${song.files_count ?? song.files?.length} 份音频` : '缺少音频'
        }}</span></RouterLink
      >
      <div class="song-actions">
        <slot :index="index" :song="song" name="actions">
          <button
            :aria-label="song.is_favorite ? `取消收藏 ${song.name}` : `收藏 ${song.name}`"
            :aria-pressed="!!song.is_favorite"
            :class="{ active: song.is_favorite }"
            :disabled="disabled || favoriting.has(song.id)"
            :title="song.is_favorite ? '取消收藏' : '收藏歌曲'"
            class="icon-button follow"
            @click="favorite(song)"
          >
            <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
              <path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1Z" />
            </svg></button
          ><button
            v-if="editable"
            :aria-label="`编辑 ${song.name}`"
            :disabled="disabled"
            class="icon-button edit"
            title="编辑资料"
            @click="emit('edit', song)"
          >
            ✎</button
          ><RouterLink
            :aria-label="`为 ${song.name} 上传音频`"
            :to="`/uploads?song=${song.id}`"
            class="icon-button"
            title="上传音频"
            >↑</RouterLink
          ><button
            :aria-label="`把 ${song.name} 加入队列`"
            class="icon-button queue-action"
            title="加入队列"
            @click="enqueue(song)"
          >
            <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
              <path d="M4 6h11M4 11h11M4 16h7M18 9v8M14 13h8" />
            </svg></button
          ><button
            :aria-label="`下一首播放 ${song.name}`"
            class="icon-button queue-action"
            title="下一首播放"
            @click="playNext(song)"
          >
            <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
              <path d="M4 6h9M4 11h9M4 16h6M16 8v7M16 8l4 2.5-4 2.5" />
            </svg>
          </button>
        </slot>
      </div>
    </article>
  </div>
</template>

<style scoped>
.song-library {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 10px;
}
.song-list {
  container-type: inline-size;
}
.song-grid {
  display: grid;
  grid-template-columns: 28px minmax(150px, 2fr) minmax(90px, 1fr) minmax(100px, 1fr) 82px 152px;
  align-items: center;
  gap: var(--space-16);
  padding: var(--space-12) var(--space-20);
}
.selectable .song-grid {
  grid-template-columns:
    20px 28px minmax(150px, 2fr) minmax(90px, 1fr) minmax(100px, 1fr)
    82px 152px;
}
.song-label {
  min-height: 44px;
  background: var(--soft);
  border-radius: var(--radius) var(--radius) 0 0;
  color: var(--muted);
  font-size: var(--font-sm);
}
.number-label {
  text-align: center;
}
.action-label {
  text-align: right;
  padding-right: 6px;
}
.song-row {
  min-height: 68px;
  border-top: 1px solid var(--line);
}
.song-row:hover {
  background: #faf9fd;
}
.song-row:last-child {
  border-radius: 0 0 var(--radius) var(--radius);
}
.song-row.playing,
.song-row.selected {
  background: #f5f1fc;
}
.song-row.playing .song-name {
  color: var(--purple-dark);
}
.song-row > input {
  margin: 0;
}
.song-play {
  display: grid;
  place-items: center;
  width: 28px;
  height: 30px;
  color: var(--muted);
  font-size: var(--font-xs);
  font-variant-numeric: tabular-nums;
}
.play-icon {
  display: none;
  color: var(--purple);
}
.song-row:hover .song-index,
.playing .song-index,
.song-play:focus-visible .song-index {
  display: none;
}
.song-row:hover .play-icon,
.playing .play-icon,
.song-play:focus-visible .play-icon {
  display: block;
}
.song-title {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  min-width: 0;
}
.song-title > .cover {
  width: 42px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
}
.song-info {
  min-width: 0;
  flex: 1;
}
.song-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-md);
  font-weight: 550;
}
.song-name:hover,
.song-artists a:hover,
.song-album:hover {
  color: var(--purple);
}
.song-name small {
  margin-left: 6px;
  font-size: var(--font-xs);
  color: var(--muted);
  font-weight: 400;
}
.song-artists,
.song-album {
  color: var(--muted);
  font-size: var(--font-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mobile-meta,
.mobile-resource {
  display: none;
}
.mobile-artist {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-sm);
  color: var(--muted);
}
.song-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}
.song-actions .icon-button {
  font-size: 17px;
}
.follow {
  color: var(--muted);
}
.follow.active {
  color: var(--purple-dark);
}
.follow.active .ui-icon {
  fill: var(--lilac);
}
@container (max-width: 800px) {
  .song-grid {
    grid-template-columns: 26px minmax(140px, 1.7fr) minmax(90px, 1fr) 82px 152px;
    gap: var(--space-8);
    padding-inline: var(--space-16);
  }
  .selectable .song-grid {
    grid-template-columns: 20px 26px minmax(140px, 1.7fr) minmax(90px, 1fr) 82px 152px;
  }
  .song-artists {
    display: none;
  }
  .mobile-meta {
    display: block;
  }
  .song-row {
    min-height: 68px;
  }
}
@container (max-width: 600px) {
  .song-grid {
    grid-template-columns: 26px minmax(120px, 1fr) 82px 70px;
  }
  .selectable .song-grid {
    grid-template-columns: 20px 26px minmax(120px, 1fr) 82px 70px;
  }
  .song-album,
  .song-actions .edit,
  .song-actions .queue-action {
    display: none;
  }
}
@container (max-width: 400px) {
  .song-grid {
    grid-template-columns: 24px minmax(0, 1fr) 70px;
    gap: var(--space-4) var(--space-8);
  }
  .selectable .song-grid {
    grid-template-columns: 18px 24px minmax(0, 1fr) 70px;
  }
  .song-row {
    padding-block: var(--space-12);
  }
  .song-row > input {
    grid-column: 1;
    grid-row: 1;
  }
  .song-row .song-play {
    grid-column: 1;
    grid-row: 1;
  }
  .selectable .song-play {
    grid-column: 2;
  }
  .song-title {
    grid-column: 2;
    grid-row: 1;
  }
  .selectable .song-title {
    grid-column: 3;
  }
  .song-title > .cover {
    display: none;
  }
  .song-resources {
    display: none;
  }
  .mobile-meta {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }
  .mobile-artist {
    min-width: 0;
  }
  .mobile-resource {
    display: inline;
    flex-shrink: 0;
  }
  .song-actions {
    grid-column: 3;
    grid-row: 1;
  }
  .selectable .song-actions {
    grid-column: 4;
  }
  .resource-label {
    display: none;
  }
}
@media (pointer: coarse) {
  .song-actions .icon-button {
    width: 32px;
    min-width: 32px;
    height: 36px;
  }
  .song-play {
    min-height: 36px;
  }
  .song-index {
    display: none;
  }
  .play-icon {
    display: block;
  }
}
</style>
