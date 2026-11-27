<script lang="ts" setup>
import Tabs from '@/components/ui/Tabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import { computed, provide, reactive, ref } from 'vue'
import type { Entity } from '@/types/catalog'
import { usePlayerStore } from '@/stores/player'
import { catalogLabels as labels } from '@/features/catalog/config'
import { useEntityDetail } from '@/features/catalog/useEntityDetail'
import { useDetailOperations } from '@/features/catalog/useDetailOperations'
import { useSongUploads } from '@/features/catalog/useSongUploads'
import { getAllSongs } from '@/features/catalog/songs'
import { notify, report } from '@/composables/useFeedback'
import { QUEUE_LIMIT } from '@/stores/queue'
import { useSongLyrics } from '@/features/catalog/useSongLyrics'
import DetailHero from './detail/DetailHero.vue'
import LyricsDialogs from './detail/LyricsDialogs.vue'
import LyricsPanel from './detail/LyricsPanel.vue'
import { songLyricsKey } from './detail/lyricsContext'
import { tracksContextKey, uploadContextKey } from './detail/detailContext'
import TracksSection from './detail/TracksSection.vue'
import UploadDialog from './detail/UploadDialog.vue'
import ResourcesPanel from './detail/ResourcesPanel.vue'
import OperationDialog from './detail/OperationDialog.vue'
import { operationContextKey } from './detail/operationContext'
import EditorDialog from '@/components/EditorDialog.vue'
import MetadataDialog from '@/components/MetadataDialog.vue'
import { date, displayName } from '@/utils/format'

const player = usePlayerStore()
const detail = useEntityDetail()
const { type, id, backTo, item, songs, page, total, busy, error, load, loadSongs } = detail
const tracksStatus = detail.tracksStatus
const queueLabel = type === 'albums' ? '专辑' : type === 'playlists' ? '歌单' : ''
const playingAll = ref(false)
async function playAll() {
  if (playingAll.value) return
  playingAll.value = true
  try {
    // 拉全量、按后端页大小翻页、异常守卫都在 getAllSongs 里，这里只表达意图
    const { items, total } = await getAllSongs(type, id, QUEUE_LIMIT)
    if (total > items.length) notify(`队列最多 ${QUEUE_LIMIT} 首，已加入前 ${items.length} 首。`)
    await player.playList(items, 0, queueLabel)
  } catch (e) {
    report(e)
  } finally {
    playingAll.value = false
  }
}
const options = useDetailOperations(detail)
const { busy: operationBusy, canEdit, openOperation, setDefault, favorite } = options
const songUploadState = useSongUploads(detail)
const {
  busy: uploadNoticeBusy,
  uploadOpen,
  uploadingCount,
  unfinishedUploadCount,
} = songUploadState
const acting = computed(() => operationBusy.value || uploadNoticeBusy.value)
provide(tracksContextKey, { detail, operations: options, queueLabel, acting })
provide(uploadContextKey, { detail, uploads: songUploadState, acting })
provide(operationContextKey, { detail, operations: options, acting })
const lyrics = reactive(useSongLyrics(item))
provide(songLyricsKey, lyrics)
const editor = ref(false)
const albumEditor = ref(false)
const editingSong = ref<Entity>()
const songEditor = ref(false)
const metadata = ref(false)
const tab = ref('resources')
</script>
<template>
  <RouterLink :to="backTo" class="back-link">← 回到{{ labels[type] }}列表</RouterLink>
  <div v-if="busy && !item" class="skeleton detail-skeleton"></div>
  <EmptyState v-if="error" panel symbol="♩" title="未找到资料">
    {{ error }}
    <template #actions>
      <Button variant="secondary" @click="load">重新加载</Button>
    </template>
  </EmptyState>
  <template v-else-if="item"
    ><DetailHero
      :acting="acting"
      :can-edit="canEdit"
      :has-songs="tracksStatus === 'ready' && total > 0"
      :tracks-ready="type === 'songs' ? true : tracksStatus === 'ready'"
      :item="item"
      :label="labels[type]"
      :playing-all="playingAll"
      :type="type"
      @edit="editor = true"
      @favorite="favorite"
      @metadata="metadata = true"
      @operation="openOperation($event)"
      @play-all="playAll"
    />
    <Tabs v-if="type === 'songs'" variant="underline" class="detail-tabs">
      <button :class="{ active: tab === 'resources' }" @click="tab = 'resources'">
        音频文件 <span>{{ item.files?.length || 0 }}</span></button
      ><button :class="{ active: tab === 'lyrics' }" @click="tab = 'lyrics'">歌词</button
      ><RouterLink :to="`/history?entity_type=songs&entity_id=${id}`">操作记录 ↗</RouterLink>
    </Tabs>
    <ResourcesPanel
      v-if="type === 'songs' && tab === 'resources'"
      :acting="acting"
      :item="item"
      :unfinished-upload-count="unfinishedUploadCount"
      :uploading-count="uploadingCount"
      @operation="(mode, file) => openOperation(mode, file)"
      @set-default="setDefault"
      @upload="uploadOpen = true"
    />
    <LyricsPanel v-if="type === 'songs' && tab === 'lyrics'" />
    <TracksSection
      v-if="type !== 'songs'"
      @edit-song="
        (song) => {
          editingSong = song
          songEditor = true
        }
      "
      @manage-album="albumEditor = true"
      @page-change="
        (value: number) => {
          page = value
          loadSongs()
        }
      "
    />
    <section v-if="type === 'songs'" class="section">
      <div class="section-heading">
        <h2>
          收录专辑 <span class="muted">{{ item.albums?.length || 0 }}</span>
        </h2>
        <Button variant="secondary" @click="editor = true">编辑专辑与媒体库</Button>
      </div>
      <Card class="recording-releases" v-if="item.albums?.length">
        <RouterLink v-for="album in item.albums" :key="album.id" :to="`/albums/${album.id}`"
          ><strong>{{ album.name }}</strong
          ><span class="hint"
            >{{ album.release_year || '' }} {{ album.edition || '' }} · 第
            {{ album.pivot?.disc_number }} 碟 · 第 {{ album.pivot?.track_number }} 首</span
          ></RouterLink
        >
      </Card>
      <p v-else class="hint">暂未收录到专辑，可作为单曲保留。</p>
    </section>
    <section v-if="type === 'songs' && item.recording_tracks?.length" class="section">
      <h2>关联的录音版本</h2>
      <Card class="recording-releases">
        <RouterLink
          v-for="track in item.recording_tracks"
          :key="track.id"
          :to="`/songs/${track.id}`"
          ><strong>{{ track.name }} {{ track.recording_version }}</strong
          ><span class="hint"
            >{{ track.albums?.map((album) => album.name).join(' / ') || '单曲' }} ·
            {{ track.library?.name }}</span
          ></RouterLink
        >
      </Card>
    </section>
    <div class="detail-foot">
      <span
        >由 {{ displayName(item.creator || item.owner) }} 创建 · {{ date(item.created_at) }}</span
      ><RouterLink :to="`/history?entity_type=${type}&entity_id=${id}`">查看操作记录 ↗</RouterLink>
    </div>
    <UploadDialog />
    <LyricsDialogs :type="type" />
    <EditorDialog
      v-if="type === 'albums' && tracksStatus === 'ready'"
      v-model="albumEditor"
      :album="item"
      :tracks="songs"
      type="songs"
      @saved="load"
    />
    <EditorDialog v-model="songEditor" :item="editingSong" type="songs" @saved="loadSongs" />
    <EditorDialog v-model="editor" :item="item" :type="type" @saved="load" />
    <MetadataDialog v-model="metadata" :item="item" :type="type" />
    <OperationDialog :item="item" />
  </template>
</template>
<style scoped src="./detail/DetailView.styles.css"></style>
