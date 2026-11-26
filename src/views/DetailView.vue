<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import type { Entity } from '@/types/catalog'
import { useSignStore } from '@/stores/sign'
import { usePlayerStore } from '@/stores/player'
import { ACTIVE_UPLOAD_STATES, TRANSMIT_STATES } from '@/features/uploads/model'
import { catalogLabels as labels } from '@/features/catalog/config'
import { useEntityDetail } from '@/features/catalog/useEntityDetail'
import { useDetailOperations } from '@/features/catalog/useDetailOperations'
import { useSongUploads } from '@/features/catalog/useSongUploads'
import { getAllSongs } from '@/features/catalog/songs'
import { notify, report } from '@/composables/useFeedback'
import { QUEUE_LIMIT } from '@/stores/queue'
import { lyricFormats, lyricKinds, useSongLyrics } from '@/features/catalog/useSongLyrics'
import DetailHero from './detail/DetailHero.vue'
import ResourcesPanel from './detail/ResourcesPanel.vue'
import EditorDialog from '@/components/EditorDialog.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import MetadataDialog from '@/components/MetadataDialog.vue'
import SongList from '@/components/SongList.vue'
import Pagination from '@/components/Pagination.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import { date, displayName } from '@/utils/format'

const sign = useSignStore()
const player = usePlayerStore()
const detail = useEntityDetail()
const {
  type,
  id,
  backTo,
  item,
  songs,
  page,
  total,
  songPageSize,
  busy,
  error,
  editable,
  load,
  loadSongs,
} = detail
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
const {
  busy: operationBusy,
  run,
  operation,
  reason,
  targetQuery,
  targets,
  target,
  selectedFile,
  trackDraft,
  selectedEntries,
  managingTracks,
  movingEntry,
  movePosition,
  canEdit,
  openOperation,
  searchTargets,
  apply,
  setDefault,
  tracks,
  toggleEntry,
  selectPage,
  moveEntry,
  removeEntries,
  reorder,
  favorite,
} = useDetailOperations(detail)
const {
  uploads,
  busy: uploadNoticeBusy,
  uploadOpen,
  uploadAccepted,
  addingFiles,
  audioInput,
  hasNotice,
  audioAccept,
  songUploads,
  uploadingCount,
  unfinishedUploadCount,
  uploadStates,
  chooseAudio,
  acceptUploadNotice,
} = useSongUploads(detail)
const acting = computed(() => operationBusy.value || uploadNoticeBusy.value)
const lyrics = reactive(useSongLyrics(item))
const editor = ref(false)
const albumEditor = ref(false)
const editingSong = ref<Entity>()
const songEditor = ref(false)
const metadata = ref(false)
const tab = ref('resources')
const lyricInput = ref<HTMLInputElement>()
</script>
<template>
  <RouterLink :to="backTo" class="back-link">← 回到{{ labels[type] }}列表</RouterLink>
  <div v-if="busy && !item" class="skeleton detail-skeleton"></div>
  <div v-if="error" class="empty panel">
    <span class="empty-symbol">♩</span>
    <h2>未找到资料</h2>
    <p>{{ error }}</p>
    <button class="button secondary" @click="load">重新加载</button>
  </div>
  <template v-else-if="item"
    ><DetailHero
      :acting="acting"
      :can-edit="canEdit"
      :has-songs="songs.length > 0"
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
    <div v-if="type === 'songs'" class="detail-tabs">
      <button :class="{ active: tab === 'resources' }" @click="tab = 'resources'">
        音频文件 <span>{{ item.files?.length || 0 }}</span></button
      ><button :class="{ active: tab === 'lyrics' }" @click="tab = 'lyrics'">歌词</button
      ><RouterLink :to="`/history?entity_type=songs&entity_id=${id}`">操作记录 ↗</RouterLink>
    </div>
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
    <section v-if="type === 'songs' && tab === 'lyrics'" class="panel lyrics-panel">
      <div class="section-heading">
        <h2>
          歌词 <span class="muted">{{ lyrics.versions.length }} 个版本</span>
        </h2>
        <button class="button primary" @click="lyrics.edit()">＋ 添加版本</button>
      </div>
      <template v-if="lyrics.selected">
        <div class="lyric-toolbar">
          <BaseSelect v-model="lyrics.selectedId" :options="lyrics.options" label="选择歌词版本" />
          <div class="button-group">
            <button
              :disabled="lyrics.busy"
              class="button secondary"
              @click="lyrics.edit(lyrics.selected)"
            >
              编辑
            </button>
            <button
              v-if="!lyrics.selected.is_default"
              :disabled="lyrics.busy"
              class="button secondary"
              @click="lyrics.setDefault"
            >
              设为默认
            </button>
            <button class="button secondary" @click="lyrics.download">下载</button>
            <button
              v-if="lyrics.selected.user_id === sign.user?.id || sign.canModerate"
              :disabled="lyrics.busy"
              class="text-button danger"
              @click="lyrics.remove"
            >
              删除
            </button>
          </div>
        </div>
        <p class="hint">
          {{ lyricKinds.find((kind) => kind.value === lyrics.selected?.kind)?.label }} ·
          {{ lyrics.selected.language }}
          <span v-if="lyrics.selected.source_format === 'sylt'"> · 内嵌同步歌词</span>
          <span v-if="lyrics.selected.source"> · 来源：{{ lyrics.selected.source }}</span>
          · {{ date(lyrics.selected.updated_at) }}
        </p>
        <div class="segmented lyric-display">
          <button :class="{ active: !lyrics.raw }" @click="lyrics.raw = false">阅读</button>
          <button :class="{ active: lyrics.raw }" @click="lyrics.raw = true">原文与时间标签</button>
        </div>
        <pre>{{ lyrics.raw ? lyrics.selected.content : lyrics.preview }}</pre>
      </template>
      <div v-else class="empty compact">
        <span class="empty-symbol">♩</span>
        <h3>暂无歌词</h3>
        <p>可以添加纯文本、逐行或逐字同步歌词，也可以保留不同语言的版本。</p>
        <button class="button secondary" @click="lyrics.edit()">添加歌词</button>
      </div>
    </section>
    <section v-if="type !== 'songs'" class="section">
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
          <button v-if="songs.length" class="button secondary" @click="albumEditor = true">
            管理本页曲目</button
          ><RouterLink class="button secondary" to="/songs">选择歌曲 →</RouterLink>
        </div>
      </div>
      <p v-if="type === 'playlists' && item.collaborators?.length" class="muted collaborators">
        协作者：{{ item.collaborators.map((m) => displayName(m)).join('、') }}
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
          @edit="
            (song) => {
              editingSong = song
              songEditor = true
            }
          "
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
        @change="
          (value: number) => {
            page = value
            loadSongs()
          }
        "
      />
    </section>
    <section v-if="type === 'songs'" class="section">
      <div class="section-heading">
        <h2>
          收录专辑 <span class="muted">{{ item.albums?.length || 0 }}</span>
        </h2>
        <button class="button secondary" @click="editor = true">编辑专辑与媒体库</button>
      </div>
      <div v-if="item.albums?.length" class="panel recording-releases">
        <RouterLink v-for="album in item.albums" :key="album.id" :to="`/albums/${album.id}`"
          ><strong>{{ album.name }}</strong
          ><span class="hint"
            >{{ album.release_year || '' }} {{ album.edition || '' }} · 第
            {{ album.pivot?.disc_number }} 碟 · 第 {{ album.pivot?.track_number }} 首</span
          ></RouterLink
        >
      </div>
      <p v-else class="hint">暂未收录到专辑，可作为单曲保留。</p>
    </section>
    <section v-if="type === 'songs' && item.recording_tracks?.length" class="section">
      <h2>关联的录音版本</h2>
      <div class="panel recording-releases">
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
      </div>
    </section>
    <div class="detail-foot">
      <span
        >由 {{ displayName(item.creator || item.owner) }} 创建 · {{ date(item.created_at) }}</span
      ><RouterLink :to="`/history?entity_type=${type}&entity_id=${id}`">查看操作记录 ↗</RouterLink>
    </div>
    <BaseDialog
      v-if="type === 'songs'"
      v-model="uploadOpen"
      :busy="addingFiles"
      :title="`为「${item.name}」上传音频`"
    >
      <div class="form-stack">
        <p class="notice">
          上传完成后直接加入这首歌曲。请确认歌手和录音版本一致。<span v-if="item.recording_version"
            >当前版本：{{ item.recording_version }}</span
          >
        </p>
        <template v-if="!hasNotice">
          <h3>上传须知</h3>
          <p class="preline hint">{{ sign.config?.notice.text }}</p>
          <label class="check-label"
            ><input v-model="uploadAccepted" type="checkbox" />我已阅读并同意上传须知</label
          >
          <button
            :disabled="!uploadAccepted || acting"
            class="button primary"
            @click="acceptUploadNotice"
          >
            确认须知
          </button>
        </template>
        <input
          ref="audioInput"
          :accept="audioAccept"
          hidden
          multiple
          type="file"
          @change="chooseAudio"
        />
        <button
          :disabled="!hasNotice || addingFiles"
          class="button primary"
          @click="audioInput?.click()"
        >
          {{ addingFiles ? '正在读取文件…' : '选择音频文件' }}
        </button>
        <div v-if="songUploads.length" class="song-upload-list">
          <article v-for="task in songUploads" :key="task.id">
            <strong>{{ task.name }}</strong>
            <span class="hint"
              >{{ uploadStates[task.state]
              }}<template v-if="task.state === 'uploading'"> · {{ task.progress }}%</template></span
            >
            <progress
              v-if="ACTIVE_UPLOAD_STATES.includes(task.state)"
              :aria-label="`${task.name} 上传进度`"
              :value="task.state === 'preparing' ? task.preparationProgress || 0 : task.progress"
              max="100"
            ></progress>
            <p v-if="task.error" class="error-text">{{ task.error }}</p>
            <p v-if="task.state === 'duplicate'" class="hint">
              相同文件已存在，可使用已有文件或跳过。<RouterLink
                v-if="uploads.duplicateFile(task)?.song_id"
                :to="`/songs/${uploads.duplicateFile(task)?.song_id}`"
                class="text-link"
                >查看已有歌曲</RouterLink
              >
            </p>
            <div class="button-group">
              <button
                v-if="TRANSMIT_STATES.includes(task.state)"
                class="text-button"
                @click="run(() => uploads.pause(task))"
              >
                暂停
              </button>
              <button
                v-if="['paused', 'failed'].includes(task.state)"
                class="text-button"
                @click="run(() => uploads.retry(task))"
              >
                重试
              </button>
              <button
                v-if="task.state === 'failed' && !task.file"
                class="text-button"
                @click="uploads.restart(task)"
              >
                重新上传
              </button>
              <template v-if="task.state === 'duplicate'"
                ><button
                  :disabled="!uploads.duplicateFile(task)"
                  class="text-button"
                  @click="run(() => uploads.useDuplicate(task))"
                >
                  使用已有文件</button
                ><button class="text-button" @click="uploads.skip(task)">跳过</button></template
              >
            </div>
          </article>
        </div>
        <RouterLink class="text-link" to="/uploads">管理全部上传任务 →</RouterLink>
      </div>
    </BaseDialog>
    <BaseDialog
      v-if="type === 'songs'"
      v-model="lyrics.editor"
      :busy="lyrics.busy"
      :title="lyrics.editingId ? '编辑歌词版本' : '添加歌词版本'"
      wide
    >
      <form id="song-lyrics-form" class="form-stack" @submit.prevent="lyrics.save">
        <div class="form-grid">
          <label
            >版本名称<input
              v-model="lyrics.form.name"
              maxlength="100"
              placeholder="如：官方原文、简体翻译、现场逐字版"
              required
          /></label>
          <label
            >语言<input
              v-model="lyrics.form.language"
              maxlength="35"
              placeholder="zh-Hans、en、und"
              required
          /></label>
          <label
            >格式<BaseSelect
              v-model="lyrics.form.format"
              :options="lyricFormats"
              :searchable="false"
              label="歌词格式"
          /></label>
          <label
            >用途<BaseSelect
              v-model="lyrics.form.kind"
              :options="lyricKinds"
              :searchable="false"
              label="歌词用途"
          /></label>
        </div>
        <label
          >来源<input
            v-model="lyrics.form.source"
            maxlength="500"
            placeholder="提供者、来源网站或文件名（选填）"
        /></label>
        <div class="button-group">
          <input
            ref="lyricInput"
            accept=".txt,.lrc,.elrc,.ttml"
            hidden
            type="file"
            @change="lyrics.importFile"
          />
          <button
            :disabled="lyrics.busy"
            class="button secondary"
            type="button"
            @click="lyricInput?.click()"
          >
            从文件导入
          </button>
          <span class="hint">UTF-8 编码，保留原始歌词和时间标签。</span>
        </div>
        <label
          >歌词内容<textarea
            v-model="lyrics.form.content"
            maxlength="100000"
            required
            rows="16"
            spellcheck="false"
          ></textarea>
        </label>
        <label class="check-label"
          ><input v-model="lyrics.form.is_default" type="checkbox" />设为默认歌词版本</label
        >
      </form>
      <template #footer
        ><button :disabled="lyrics.busy" class="button secondary" @click="lyrics.editor = false">
          取消</button
        ><button :disabled="lyrics.busy" class="button primary" form="song-lyrics-form">
          {{ lyrics.busy ? '正在保存…' : '保存版本' }}
        </button></template
      >
    </BaseDialog>
    <BaseDialog
      v-if="type === 'songs'"
      v-model="lyrics.removing"
      :busy="lyrics.busy"
      title="删除歌词版本"
    >
      <div class="form-stack">
        <p class="hint">会保留操作记录，可从记录中恢复。</p>
        <label
          >删除原因<textarea
            v-model="lyrics.reason"
            :required="lyrics.selected?.user_id !== sign.user?.id"
            maxlength="1000"
            rows="3"
          ></textarea>
        </label>
      </div>
      <template #footer
        ><button :disabled="lyrics.busy" class="button secondary" @click="lyrics.removing = false">
          取消</button
        ><button
          :disabled="
            lyrics.busy || (lyrics.selected?.user_id !== sign.user?.id && !lyrics.reason.trim())
          "
          class="button primary"
          @click="lyrics.destroy"
        >
          确认删除
        </button></template
      >
    </BaseDialog>
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
              /><button :disabled="acting" class="button secondary" @click="searchTargets">
                搜索
              </button>
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
            ><button
              :aria-label="`上移 ${s.name}`"
              :disabled="index === 0"
              class="icon-button"
              @click="reorder(index, -1)"
            >
              ↑</button
            ><button
              :aria-label="`下移 ${s.name}`"
              :disabled="index === trackDraft.length - 1"
              class="icon-button"
              @click="reorder(index, 1)"
            >
              ↓</button
            ><button
              :aria-label="`移除 ${s.name}`"
              class="icon-button danger"
              @click="trackDraft.splice(index, 1)"
            >
              ×
            </button>
          </article>
        </div>
      </div>
      <template #footer
        ><button :disabled="acting" class="button secondary" @click="operation = ''">取消</button
        ><button
          :disabled="
            acting ||
            ((operation === 'merge' || operation === 'file-move') && !target) ||
            (operation === 'merge' && !reason.trim()) ||
            (operation === 'tracks' && !trackDraft.length) ||
            (operation === 'playlist-move' &&
              (!Number.isInteger(movePosition) || movePosition < 1 || movePosition > total))
          "
          class="button primary"
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
        </button></template
      ></BaseDialog
    ></template
  >
</template>

<style scoped src="./detail/DetailView.styles.css"></style>
