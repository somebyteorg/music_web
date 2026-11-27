<script lang="ts" setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
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
        <Button variant="primary" :disabled="acting" @click="tracks">添加歌曲</Button>
        <Button variant="secondary" :disabled="acting" @click="managingTracks = !managingTracks">
          {{ managingTracks ? '完成管理' : '管理本页曲目' }}
        </Button>
        <Button
          variant="secondary"
          v-if="managingTracks && selectedEntries.length"
          :disabled="acting"
          @click="removeEntries(selectedEntries)"
        >
          移除已选 {{ selectedEntries.length }} 首
        </Button>
      </div>
      <div v-else-if="type === 'albums'" class="button-group">
        <Button variant="secondary" v-if="songs.length" @click="emit('manageAlbum')">
          管理本页曲目</Button
        ><RouterLink class="button secondary" to="/songs">选择歌曲 →</RouterLink>
      </div>
    </div>
    <p v-if="type === 'playlists' && collaborators.length" class="muted collaborators">
      协作者：{{ collaborators.map((m) => displayName(m)).join('、') }}
    </p>
    <Card>
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
      <EmptyState v-else symbol="♫" as="h3" title="暂无歌曲"> 添加歌曲后会显示在这里。 </EmptyState>
    </Card>
    <Pagination
      :page="page"
      :page-size="songPageSize"
      :total="total"
      @change="(value: number) => emit('pageChange', value)"
    />
  </section>
</template>
