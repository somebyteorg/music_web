<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
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
import EditorDialog from '@/components/EditorDialog.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import MetadataDialog from '@/components/MetadataDialog.vue'
import { date, displayName } from '@/utils/format'

const player = usePlayerStore()
const detail = useEntityDetail()
const { type, id, backTo, item, songs, page, total, busy, error, load, loadSongs } = detail
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
const {
  busy: operationBusy,
  operation,
  reason,
  targetQuery,
  targets,
  target,
  selectedFile,
  trackDraft,
  movingEntry,
  movePosition,
  canEdit,
  openOperation,
  searchTargets,
  apply,
  setDefault,
  reorder,
  favorite,
} = options
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
      :has-songs="type === 'songs' ? false : songs.length > 0"
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
      v-if="type === 'albums'"
      v-model="albumEditor"
      :album="item"
      :tracks="songs"
      type="songs"
      @saved="load"
    />
    <EditorDialog v-model="songEditor" :item="editingSong" type="songs" @saved="loadSongs" />
    <EditorDialog v-model="editor" :item="item" :type="type" @saved="load" /><MetadataDialog
      v-model="metadata"
      :item="item"
      :type="type"
    /><BaseDialog
      :busy="acting"
      :model-value="!!operation"
      :title="
        operation === 'merge'
          ? '合并重复资料'
          : operation === 'tracks'
            ? '添加歌曲'
            : operation === 'playlist-move'
              ? '调整曲序'
              : operation === 'playlist-private'
                ? '设为私密歌单'
                : operation === 'file-move'
                  ? '移动音频'
                  : operation === 'file-delete'
                    ? '删除资源'
                    : `删除${labels[type]}`
      "
      :wide="operation === 'tracks'"
      @update:model-value="
        (v) => {
          if (!v) operation = ''
        }
      "
      ><div class="form-stack">
        <p v-if="operation === 'playlist-private'">
          将「{{ item.name }}」设为创建者的私密歌单，之后仅创建者和协作者可见。
        </p>
        <p v-if="operation === 'delete'" class="hint">
          {{
            type === 'playlists'
              ? '删除后歌单将不可见，不提供曲目恢复。'
              : '删除后可从操作记录中恢复。请先移出关联的歌曲或音频。'
          }}
        </p>
        <p v-if="operation === 'file-delete'" class="hint">
          {{ selectedFile?.file_name }}<br />确认删除这份资源？原文件会保留，可从操作记录中恢复。
        </p>
        <p v-if="operation === 'merge'" class="hint">
          将「{{
            item.name
          }}」的音频和关联资料合并到所选条目，随后删除当前条目。请确认歌手和录音版本一致。
        </p>
        <template v-if="['merge', 'file-move', 'tracks'].includes(operation)"
          ><label
            >{{ operation === 'merge' ? '选择合并目标' : '搜索歌曲' }}
            <div class="search-inline">
              <input
                v-model="targetQuery"
                placeholder="输入名称搜索"
                @keydown.enter.prevent="searchTargets"
              /><Button variant="secondary" :disabled="acting" @click="searchTargets">
                搜索
              </Button>
            </div></label
          >
          <div class="picker-results">
            <button
              v-for="t in targets"
              :key="t.id"
              :class="{ selected: target?.id === t.id }"
              :disabled="operation === 'tracks' && trackDraft.some((s) => s.id === t.id)"
              @click="operation === 'tracks' ? trackDraft.push(t) : (target = t)"
            >
              <span>{{ t.name }}</span><small>{{
                t.artists?.map((a) => a.name).join(' / ') || t.recording_version || ''
              }}</small
              ><span v-if="target?.id === t.id">✓</span>
            </button>
          </div>
          <p v-if="target" class="notice">
            已选择：{{ target.name }}
            <span v-if="target.recording_version">({{ target.recording_version }})</span>
          </p></template
        ><label v-if="['merge', 'delete', 'file-delete'].includes(operation)"
          >写下原因<textarea
            v-model="reason"
            maxlength="1000"
            placeholder="请说明操作原因。"
            rows="3"
          ></textarea>
        </label>
        <label v-if="operation === 'playlist-move'">
          将「{{ movingEntry?.name }}」移到第几首
          <input v-model.number="movePosition" :max="total" min="1" step="1" type="number" />
          <span class="hint">共 {{ total }} 首，可直接移到其他页面的位置。</span>
        </label>
        <div v-if="operation === 'tracks'" class="track-editor">
          <p class="hint">已选 {{ trackDraft.length }} 首 · 将按此顺序添加到歌单末尾。</p>
          <article v-for="(s, index) in trackDraft" :key="s.id">
            <span class="muted">{{ index + 1 }}</span><strong>{{ s.name }}</strong
            ><IconButton
              :label="`上移 ${s.name}`"
              :disabled="index === 0"
              @click="reorder(index, -1)"
            >
              ↑</IconButton
            ><IconButton
              :label="`下移 ${s.name}`"
              :disabled="index === trackDraft.length - 1"
              @click="reorder(index, 1)"
            >
              ↓</IconButton
            ><IconButton
              :label="`移除 ${s.name}`"
              class="danger"
              @click="trackDraft.splice(index, 1)"
            >
              ×
            </IconButton>
          </article>
        </div>
      </div>
      <template #footer
        ><Button variant="secondary" :disabled="acting" @click="operation = ''">取消</Button
        ><Button
          variant="primary"
          :disabled="
            acting ||
            ((operation === 'merge' || operation === 'file-move') && !target) ||
            (operation === 'merge' && !reason.trim()) ||
            (operation === 'tracks' && !trackDraft.length) ||
            (operation === 'playlist-move' &&
              (!Number.isInteger(movePosition) || movePosition < 1 || movePosition > total))
          "
          @click="apply"
        >
          {{
            acting
              ? '正在处理…'
              : operation === 'tracks'
                ? '添加到歌单'
                : operation === 'merge'
                  ? '确认合并'
                  : operation === 'playlist-private'
                    ? '确认设为私密'
                    : operation === 'file-move' || operation === 'playlist-move'
                      ? '确认移动'
                      : '确认删除'
          }}
        </Button></template
      ></BaseDialog
    ></template
  >
</template>

<style scoped src="./detail/DetailView.styles.css"></style>
