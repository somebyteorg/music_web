<script lang="ts" setup>
import { computed, inject } from 'vue'
import SongList from '@/components/SongList.vue'
import Pagination from '@/components/Pagination.vue'
import { displayName } from '@/utils/format'
import type { Entity } from '@/types/catalog'
import { tracksContextKey } from './detailContext'

const emit = defineEmits<{
  manageAlbum: []
  editSong: [song: Entity]
  pageChange: [page: number]
}>()

const context = inject(tracksContextKey)
if (!context) throw new Error('曲目区缺少上下文（tracksContextKey）')
const { acting } = context
const { type, id, item, songs, total, page, songPageSize, editable } = context.detail
const {
  managingTracks,
  selectedEntries,
  removeEntries,
  toggleEntry,
  selectPage,
  moveEntry,
  tracks,
} = context.operations
const queueLabel = context.queueLabel
const collaborators = computed(() => item.value?.collaborators ?? [])
</script>

<template>
  <section class="section">
    <div class="section-heading">
      <h2>
        {{ type === 'playlists' ? '歌单曲目' : '收录的歌曲' }}
        <span class="muted">{{ total }}</span>
      </h2>
      <div v-if="type === 'playlists' && editable" class="button-group">
        <button :disabled="acting" class="button primary" @click="tracks">添加歌曲</button>
        <button
          :disabled="acting"
          class="button secondary"
          @click="managingTracks = !managingTracks"
        >
          {{ managingTracks ? '完成管理' : '管理本页曲目' }}
        </button>
        <button
          v-if="managingTracks && selectedEntries.length"
          :disabled="acting"
          class="button secondary"
          @click="removeEntries(selectedEntries)"
        >
          移除已选 {{ selectedEntries.length }} 首
        </button>
      </div>
      <div v-else-if="type === 'albums'" class="button-group">
        <button v-if="songs.length" class="button secondary" @click="emit('manageAlbum')">
          管理本页曲目</button
        ><RouterLink class="button secondary" to="/songs">选择歌曲 →</RouterLink>
      </div>
    </div>
    <p v-if="type === 'playlists' && collaborators.length" class="muted collaborators">
      协作者：{{ collaborators.map((m) => displayName(m)).join('、') }}
    </p>
    <div class="panel">
      <SongList
        v-if="songs.length"
        :album-context-id="type === 'albums' ? id : undefined"
        :disabled="acting"
        :editable="type === 'albums'"
        :items="songs"
        :label="queueLabel"
        :offset="(page - 1) * songPageSize"
        :selectable="type === 'playlists' && editable && managingTracks"
        :selected="selectedEntries"
        :track-numbers="type === 'albums'"
        @edit="(song) => emit('editSong', song)"
        @favorite="
          (sid, value) => {
            songs.filter((song) => song.id === sid).forEach((song) => (song.is_favorite = value))
          }
        "
        @select="toggleEntry"
        @select-all="selectPage"
      >
        <template
          v-if="type === 'playlists' && editable && managingTracks"
          #actions="{ song, index }"
        >
          <button :disabled="acting" class="text-button" @click="moveEntry(song, index)">
            移动
          </button>
          <button
            :disabled="acting"
            class="text-button danger"
            @click="removeEntries([song.entry_id!])"
          >
            移除
          </button>
        </template>
      </SongList>
      <div v-else class="empty">
        <span class="empty-symbol">♫</span>
        <h3>暂无歌曲</h3>
        <p>添加歌曲后会显示在这里。</p>
      </div>
    </div>
    <Pagination
      :page="page"
      :page-size="songPageSize"
      :total="total"
      @change="(value: number) => emit('pageChange', value)"
    />
  </section>
</template>
