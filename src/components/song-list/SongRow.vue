<script lang="ts" setup>
import EntityCover from '@/components/EntityCover.vue'
import Tag from '@/components/ui/Tag.vue'
import { audioLabel } from '@/utils/audio'
import type { Entity } from '@/types/catalog'
import SongActions from './SongActions.vue'
import { useSongListContext, type SongListRowActions } from './songListContext'

/** 一行歌曲：曲序/试听、封面与标题、歌手、专辑、音频资源、操作格。 */
const props = defineProps<{ song: Entity; index: number }>()
defineSlots<{ actions?: (props: SongListRowActions) => unknown }>()
const {
  props: listProps,
  player,
  queue,
  rowKey,
  hasAudio,
  position,
  artistNames,
  play,
  toggle,
} = useSongListContext()
</script>

<template>
  <article
    :class="[
      'song-row',
      'song-grid',
      {
        playing: queue.isCurrent(props.song.id),
        selected: listProps.selected?.includes(rowKey(props.song)),
      },
    ]"
  >
    <input
      v-if="listProps.selectable"
      :aria-label="`选择 ${props.song.name}`"
      :checked="listProps.selected?.includes(rowKey(props.song))"
      :disabled="listProps.disabled"
      type="checkbox"
      @change="toggle(props.song)"
    />
    <button
      :aria-label="`${player.song?.id === props.song.id && player.playing ? '暂停' : '试听'} ${props.song.name}`"
      :disabled="!hasAudio(props.song)"
      :title="
        listProps.trackNumbers
          ? `第 ${position(props.song)?.disc_number} 碟第 ${position(props.song)?.track_number} 首`
          : player.song?.id === props.song.id && player.playing
            ? '暂停'
            : '试听'
      "
      class="song-play"
      @click="play(props.song, props.index)"
    >
      <span class="song-index">{{
        listProps.trackNumbers
          ? `${position(props.song)?.disc_number}.${String(position(props.song)?.track_number).padStart(2, '0')}`
          : listProps.offset + props.index + 1
      }}</span><svg aria-hidden="true" class="ui-icon playback-icon play-icon" viewBox="0 0 24 24">
        <path
          :d="
            player.song?.id === props.song.id && player.playing
              ? 'M6 5h4v14H6zM14 5h4v14h-4z'
              : 'm8 5 11 7-11 7Z'
          "
        />
      </svg>
    </button>
    <div class="song-title">
      <EntityCover
        :item="
          props.song.cover_id || props.song.image_url
            ? props.song
            : props.song.albums?.[0] || props.song
        "
      />
      <div class="song-info">
        <RouterLink :title="props.song.name" :to="`/songs/${props.song.id}`" class="song-name"
          >{{ props.song.name
          }}<small v-if="props.song.recording_version">{{
            props.song.recording_version
          }}</small></RouterLink
        >
        <div class="mobile-meta">
          <span class="mobile-artist">{{ artistNames(props.song) }}</span><RouterLink
            :to="
              hasAudio(props.song) ? `/songs/${props.song.id}` : `/uploads?song=${props.song.id}`
            "
            class="mobile-resource"
            ><Tag :variant="!hasAudio(props.song) ? 'warning' : 'default'">{{
              hasAudio(props.song) ? audioLabel(props.song) : '缺少音频'
            }}</Tag></RouterLink
          >
        </div>
      </div>
    </div>
    <div :title="artistNames(props.song)" class="song-artists">
      <template v-if="props.song.artists?.length"
        ><RouterLink
          v-for="(artist, artistIndex) in props.song.artists"
          :key="artist.id"
          :to="`/artists/${artist.id}`"
          >{{ artistIndex ? ' / ' : '' }}{{ artist.name }}</RouterLink
        ></template
      ><span v-else>未填写</span>
    </div>
    <div class="song-album">
      <template v-if="props.song.albums?.length"
        ><RouterLink
          v-for="(album, i) in props.song.albums"
          :key="album.id"
          :title="album.name"
          :to="`/albums/${album.id}`"
          >{{ i ? ' / ' : '' }}{{ album.name }}</RouterLink
        ></template
      ><span v-else>单曲</span
      ><small v-if="props.song.library" class="song-library">{{ props.song.library.name }}</small>
    </div>
    <RouterLink
      :to="hasAudio(props.song) ? `/songs/${props.song.id}` : `/uploads?song=${props.song.id}`"
      class="song-resources"
      ><Tag :variant="!hasAudio(props.song) ? 'warning' : 'default'">{{
        hasAudio(props.song) ? audioLabel(props.song) : '缺少音频'
      }}</Tag></RouterLink
    >
    <div class="song-actions">
      <slot name="actions" :index="props.index" :song="props.song">
        <SongActions :song="props.song" />
      </slot>
    </div>
  </article>
</template>

<style scoped src="./songGrid.css"></style>
<style scoped src="./songRow.css"></style>
