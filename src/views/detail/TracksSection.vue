<script lang="ts" setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import ButtonGroup from '@/components/ui/ButtonGroup.vue'
import TextButton from '@/components/ui/TextButton.vue'
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
const {
  type,
  id,
  item,
  songs,
  total,
  tracksStatus,
  tracksError,
  page,
  songPageSize,
  editable,
  loadSongs,
} = context.detail
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
const collaborators = computed(() => item.value?.collaborators)
const collaboratorNames = computed(() =>
  collaborators.value?.map((member) => displayName(member)).join('、'),
)
</script>

<template>
  <section class="section">
    <div class="section-heading">
      <h2>
        {{ type === 'playlists' ? '歌单曲目' : '收录的歌曲' }}
        <span v-if="tracksStatus === 'ready'" class="muted">{{ total }}</span>
      </h2>
      <ButtonGroup v-if="tracksStatus === 'ready' && type === 'playlists' && editable">
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
      </ButtonGroup>
      <ButtonGroup v-else-if="tracksStatus === 'ready' && type === 'albums'">
        <Button variant="secondary" v-if="songs.length" @click="emit('manageAlbum')">
          管理本页曲目</Button
        ><Button to="/songs" variant="secondary">选择歌曲 →</Button>
      </ButtonGroup>
    </div>
    <p v-if="type === 'playlists' && collaboratorNames" class="muted collaborators">
      协作者：{{ collaboratorNames }}
    </p>
    <Card>
      <div
        v-if="tracksStatus === 'idle' || tracksStatus === 'loading'"
        aria-label="正在加载曲目"
        class="tracks-loading"
        role="status"
      >
        <span v-for="n in 4" :key="n" class="skeleton tracks-skeleton-row"></span>
      </div>
      <div v-else-if="tracksStatus === 'error'" class="tracks-error" role="alert">
        <p>{{ tracksError }}</p>
        <Button variant="secondary" @click="loadSongs">重试</Button>
      </div>
      <template v-else>
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
            <TextButton :disabled="acting" @click="moveEntry(song, index)"> 移动 </TextButton>
            <TextButton
              :disabled="acting"
              variant="danger"
              @click="removeEntries([song.entry_id!])"
            >
              移除
            </TextButton>
          </template>
        </SongList>
        <EmptyState v-else symbol="♫" as="h3" title="暂无歌曲">
          添加歌曲后会显示在这里。
        </EmptyState>
      </template>
    </Card>
    <Pagination
      v-if="tracksStatus === 'ready'"
      :page="page"
      :page-size="songPageSize"
      :total="total"
      @change="(value: number) => emit('pageChange', value)"
    />
  </section>
</template>

<style scoped>
.tracks-loading {
  display: grid;
  gap: 10px;
  padding: 16px;
}
.tracks-skeleton-row {
  height: 44px;
}
.tracks-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 28px 24px;
}
.tracks-error p {
  color: var(--danger);
  font-size: 13px;
}
</style>
