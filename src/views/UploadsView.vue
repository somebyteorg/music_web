<script lang="ts" setup>
import { computed, onMounted, reactive } from 'vue'
import { useUploadsStore } from '@/stores/uploads'
import { useSignStore } from '@/stores/sign'
import BaseDialog from '@/components/BaseDialog.vue'
import Pagination from '@/components/Pagination.vue'
import Tag from '@/components/ui/Tag.vue'
import UploadQueue from '@/features/uploads/UploadQueue.vue'
import UploadBatchDialog from '@/features/uploads/UploadBatchDialog.vue'
import { usePendingUploads } from '@/features/uploads/usePendingUploads'
import { useUploadSource } from '@/features/uploads/useUploadSource'
import { useUploadBatch } from '@/features/uploads/useUploadBatch'
import { useUploadImages } from '@/features/uploads/useUploadImages'
import { useUploadPreview } from '@/features/uploads/useUploadPreview'
import type { UploadTask } from '@/features/uploads/model'
import type { AudioFile } from '@/types/uploads'
import { fileUrl } from '@/utils/file'
import { lyricFormats } from '@/features/catalog/useSongLyrics'
import { bytes, duration, qualities } from '@/utils/format'

const uploads = useUploadsStore()
const sign = useSignStore()
const {
  remotePending,
  pendingBusy,
  pendingPage,
  pendingTotal,
  pendingPageSize,
  loadPending,
  changePendingPage,
} = usePendingUploads()
const batch = reactive(useUploadBatch(loadPending))
const {
  imageAlbum,
  imageTask,
  images,
  browseImages,
  selectImage,
  inspectPicture,
  inspectPending,
  removePreviewTask,
  selectPreview,
  inspectTask,
} = useUploadImages(batch)
const {
  busy: sourceBusy,
  accepted,
  targetSong,
  hasNotice,
  accept,
  isOverDropZone,
  folderUpload,
  folderBusy,
  choose,
  confirmFolder,
  acceptNotice,
} = useUploadSource()
const {
  selected,
  confirm,
  previewOnly,
  query,
  candidates,
  song,
  busy: previewBusy,
  open,
  search,
  chooseSong,
  publish,
} = useUploadPreview(batch.show, loadPending)
const busy = computed(() => sourceBusy.value || previewBusy.value)

function fromPending(file: AudioFile) {
  void open(uploads.adopt(file))
}
function batchPending() {
  batch.show(remotePending.value.map((file) => uploads.adopt(file)))
}
function previewCover(task: UploadTask) {
  const id = task.kind === 'cover' ? task.file?.id : task.file?.preview?.cover_id
  return id ? fileUrl(id) : uploads.localCover(task)
}
onMounted(loadPending)
</script>
<template>
  <div class="page-heading">
    <div class="heading-title">
      <h1>上传文件</h1>
      <span class="muted">{{ uploads.tasks.length }} 个任务</span>
    </div>
    <button class="button secondary" type="button" @click="browseImages()">我的图片</button>
  </div>
  <section v-if="targetSong" class="notice-panel panel">
    <p>
      为
      <RouterLink :to="`/songs/${targetSong.id}`" class="text-link">{{
        targetSong.name
      }}</RouterLink>
      上传音频<span v-if="targetSong.recording_version"> · {{ targetSong.recording_version }}</span>
    </p>
    <p class="hint">所选音频完成解析后会直接加入这首歌曲，请核对录音版本。</p>
  </section>
  <section v-if="!hasNotice" class="notice-panel panel">
    <h2>上传须知</h2>
    <p class="preline">{{ sign.config?.notice.text }}</p>
    <label class="check-label"
      ><input v-model="accepted" type="checkbox" />我已阅读并同意上传须知</label
    ><button :disabled="!accepted || busy" class="button primary" @click="acceptNotice">
      确认并开始上传
    </button>
  </section>
  <section
    v-else
    ref="dropZone"
    :class="[
      'upload-drop',
      { over: isOverDropZone, compact: uploads.tasks.length > 0 || pendingTotal > 0 },
    ]"
  >
    <div class="drop-copy">
      <strong>{{
        isOverDropZone ? '松开以添加文件，文件夹会先预览' : '拖入音频、封面或文件夹'
      }}</strong>
      <p class="hint">
        音频 ≤ {{ bytes(sign.config?.max_file_size || 0) }} · 封面 ≤
        {{ bytes(sign.config?.max_cover_size || 0) }} · 支持断点续传
      </p>
    </div>
    <div class="button-group">
      <label class="button primary"
        >＋ 添加文件<input
          :accept="accept"
          class="sr-only"
          multiple
          type="file"
          @change="choose" /></label
      ><label class="button secondary"
        >添加文件夹<input class="sr-only" multiple type="file" webkitdirectory @change="choose"
      /></label>
    </div>
  </section>
  <UploadQueue
    :organizing="batch.busy"
    @inspect="inspectTask"
    @organize="batch.show"
    @preview="open"
  />
  <section v-if="pendingTotal" class="section">
    <div class="section-heading">
      <div class="heading-title">
        <h2>已上传、待确认的音频</h2>
        <span class="muted">{{ pendingTotal }} 份音频</span>
      </div>
      <div class="button-group">
        <button v-if="remotePending.length" class="button small secondary" @click="batchPending">
          批量整理本页</button
        ><button :disabled="pendingBusy" class="text-button" @click="loadPending">刷新</button>
      </div>
    </div>
    <div :aria-busy="pendingBusy" class="panel">
      <article v-for="file in remotePending" :key="file.id" class="pending-row">
        <button
          v-if="file.preview?.cover_id"
          :aria-label="`预览 ${file.file_name} 的内嵌封面`"
          class="task-thumbnail"
          type="button"
          @click="inspectPending(file)"
        >
          <img :src="fileUrl(file.preview.cover_id)" alt="" loading="lazy" /></button
        ><span v-else class="task-icon">♫</span>
        <div>
          <strong>{{ file.file_name }}</strong>
          <p class="hint">{{ qualities[file.quality] }} · {{ bytes(file.file_size) }}</p>
        </div>
        <button class="button small secondary" @click="fromPending(file)">确认归属</button>
      </article>
      <p v-if="!remotePending.length" class="pending-note hint">
        本页文件已显示在上传队列中，可直接确认归属。
      </p>
    </div>
    <Pagination
      :busy="pendingBusy"
      :page="pendingPage"
      :page-size="pendingPageSize"
      :total="pendingTotal"
      @change="changePendingPage"
    />
  </section>
  <details class="notice-details">
    <summary>上传说明与须知</summary>
    <p>
      选择文件夹后，先预览并确认要上传的图片。默认勾选 Cover、Front、Folder
      等名称的封面图。大图片会先生成压缩副本再上传，原图保留。上传完成后，确认专辑和歌曲信息，再加入曲库。
    </p>
    <p class="preline">{{ sign.config?.notice.text }}</p>
  </details>
  <BaseDialog v-model="folderUpload.open" :busy="folderBusy" title="确认文件夹中的上传内容" wide>
    <div class="form-stack">
      <p>
        找到 {{ folderUpload.audio.length }} 份音频、{{
          folderUpload.pictures.length
        }}
        张图片。当前选择上传 {{ folderUpload.selected.length }} 张图片。
      </p>
      <p class="hint">
        默认勾选
        Cover、Front、Folder、封面、正面等名称的图片。请核对缩略图，其他图片可手动勾选；移除只影响本次上传。
      </p>
      <p v-if="folderUpload.ignored" class="hint">
        已忽略 {{ folderUpload.ignored }} 个格式不支持、空文件或超过音频大小上限的文件。
      </p>
      <details v-if="folderUpload.audio.length">
        <summary>查看待上传音频（{{ folderUpload.audio.length }} 份）</summary>
        <ul class="folder-audio">
          <li v-for="(file, index) in folderUpload.audio" :key="index">
            {{ file.webkitRelativePath || file.name }}
          </li>
        </ul>
      </details>
      <div v-if="folderUpload.pictures.length" class="button-group">
        <button
          class="text-button"
          type="button"
          @click="folderUpload.pictures.forEach((picture) => (picture.selected = true))"
        >
          全选图片
        </button>
        <button
          class="text-button"
          type="button"
          @click="folderUpload.pictures.forEach((picture) => (picture.selected = false))"
        >
          取消全选
        </button>
      </div>
      <div class="image-grid">
        <article
          v-for="(picture, index) in folderUpload.pictures"
          :key="picture.url"
          :class="{ selected: picture.selected }"
          class="image-card"
        >
          <button
            :aria-label="`预览 ${picture.file.name}`"
            class="image-thumbnail"
            type="button"
            @click="folderUpload.preview = { url: picture.url, name: picture.file.name }"
          >
            <img :src="picture.url" alt="" loading="lazy" />
          </button>
          <span :title="picture.file.webkitRelativePath">{{
            picture.file.webkitRelativePath || picture.file.name
          }}</span>
          <div class="button-group">
            <label class="check-label"
              ><input v-model="picture.selected" type="checkbox" />上传</label
            ><button class="text-button" type="button" @click="folderUpload.remove(index)">
              移除
            </button>
          </div>
        </article>
      </div>
    </div>
    <template #footer>
      <button
        :disabled="folderBusy"
        class="button secondary"
        type="button"
        @click="folderUpload.open = false"
      >
        取消
      </button>
      <button
        :disabled="folderBusy || (!folderUpload.audio.length && !folderUpload.selected.length)"
        class="button primary"
        type="button"
        @click="confirmFolder"
      >
        {{
          folderBusy
            ? '正在加入队列…'
            : `上传 ${folderUpload.audio.length} 份音频和 ${folderUpload.selected.length} 张图片`
        }}
      </button>
    </template>
  </BaseDialog>
  <BaseDialog
    :model-value="!!folderUpload.preview"
    :title="folderUpload.preview?.name || '图片预览'"
    @update:model-value="
      (value) => {
        if (!value) folderUpload.preview = undefined
      }
    "
  >
    <img
      v-if="folderUpload.preview"
      :alt="folderUpload.preview.name"
      :src="folderUpload.preview.url"
      class="image-preview"
    />
    <template #footer
      ><button class="button secondary" type="button" @click="folderUpload.preview = undefined">
        关闭</button
      ><button
        class="text-button danger"
        type="button"
        @click="
          folderUpload.remove(
            folderUpload.pictures.findIndex((picture) => picture.url === folderUpload.preview?.url),
          )
        "
      >
        从本次上传移除
      </button></template
    >
  </BaseDialog>
  <BaseDialog v-model="images.open" :title="imageAlbum ? '从我的图片选择' : '我的图片'" wide>
    <div :aria-busy="images.busy" class="form-stack">
      <form class="search-inline" @submit.prevent="images.load(1)">
        <input
          v-model="images.query"
          aria-label="搜索我的图片"
          placeholder="搜索图片文件名"
        /><button :disabled="images.busy" class="button secondary">搜索</button>
      </form>
      <p class="hint">图片可重复使用。点击缩略图查看大图、使用情况或删除图片。</p>
      <p v-if="images.error" class="error-text" role="alert">{{ images.error }}</p>
      <p v-if="!images.busy && !images.items.length" class="hint">
        {{ images.query ? '没有匹配的图片。' : '暂无已上传的图片。' }}
      </p>
      <div class="image-grid">
        <article v-for="file in images.items" :key="file.id" class="image-card">
          <button
            :aria-label="`预览 ${file.file_name}`"
            :disabled="images.busy"
            class="image-thumbnail"
            type="button"
            @click="images.inspect({ id: file.id, name: file.file_name, file })"
          >
            <img :src="fileUrl(file.id)" alt="" loading="lazy" />
          </button>
          <span :title="file.file_name">{{ file.file_name }}</span>
          <button
            v-if="imageAlbum"
            :disabled="images.busy || batch.busy"
            class="text-button"
            type="button"
            @click="selectImage(file)"
          >
            选为正面图
          </button>
        </article>
      </div>
      <Pagination
        :busy="images.busy"
        :page="images.page"
        :page-size="images.pageSize"
        :total="images.total"
        @change="images.load"
      />
    </div>
    <template #footer
      ><button class="button secondary" type="button" @click="images.open = false">
        关闭
      </button></template
    >
  </BaseDialog>
  <BaseDialog
    v-model="images.previewOpen"
    :busy="images.previewBusy"
    :title="images.preview?.name || '图片预览'"
  >
    <img
      v-if="images.preview"
      :alt="images.preview.name"
      :src="images.preview.url || fileUrl(images.preview.id)"
      class="image-preview"
    />
    <p v-if="images.references.length" class="hint">
      使用位置：{{ images.references.join('、') }}。请先从这些位置移除图片，再删除。
    </p>
    <p v-if="images.previewError" class="error-text" role="alert">{{ images.previewError }}</p>
    <p v-if="images.confirmDelete" class="notice">确认删除这张已上传的图片？</p>
    <template #footer>
      <button
        :disabled="images.previewBusy"
        class="button secondary"
        type="button"
        @click="images.previewOpen = false"
      >
        关闭
      </button>
      <button
        v-if="images.preview?.file"
        :disabled="
          images.previewBusy || !!images.previewError || !!images.references.length || batch.busy
        "
        class="text-button danger"
        type="button"
        @click="images.confirmDelete ? images.remove() : (images.confirmDelete = true)"
      >
        {{ images.confirmDelete ? '确认删除' : '删除图片' }}
      </button>
      <button
        v-if="imageTask && !imageTask.file && images.preview?.url"
        class="text-button danger"
        type="button"
        @click="removePreviewTask"
      >
        移除上传任务
      </button>
      <button
        v-if="imageAlbum && images.preview"
        :disabled="images.previewBusy || batch.busy"
        class="button primary"
        type="button"
        @click="selectPreview"
      >
        选为正面图
      </button>
    </template>
  </BaseDialog>
  <BaseDialog v-model="confirm" :busy="busy" :title="previewOnly ? '解析结果预览' : '确认歌曲归属'"
    ><div v-if="selected" class="form-stack">
      <p class="hint">
        {{ selected.name }}
        <span v-if="selected.file">· {{ qualities[selected.file.quality] }}</span>
      </p>
      <div v-if="selected.file" class="parsed-preview">
        <img
          v-if="previewCover(selected)"
          :alt="`${selected.title} 封面`"
          :src="previewCover(selected)"
          class="parsed-cover"
        />
        <div v-else aria-hidden="true" class="parsed-cover placeholder">♫</div>
        <div class="parsed-details">
          <strong>{{ selected.title }}</strong>
          <p class="hint">
            {{ selected.artist || '未识别歌手' }} · {{ selected.album || '未识别专辑' }}
          </p>
          <p v-if="selected.kind === 'audio'" class="hint">
            {{ selected.file.codec.toUpperCase() }} ·
            {{ selected.file.sample_rate / 1000 }} kHz<span v-if="selected.file.bit_depth">
              / {{ selected.file.bit_depth }} bit</span
            >
            · {{ duration(selected.file.duration) }} · {{ bytes(selected.file.file_size) }}
          </p>
          <div v-if="selected.file.preview?.lyrics.length" class="parsed-lyrics">
            <Tag v-for="(lyric, index) in selected.file.preview.lyrics" :key="index" variant="brand"
              >{{ lyricFormats.find((format) => format.value === lyric.format)?.label }} ·
              {{ lyric.language }}</Tag
            >
          </div>
          <p v-else-if="selected.kind === 'audio'" class="hint">没有内嵌歌词，可在歌曲页补充。</p>
        </div>
      </div>
      <ul v-if="selected.file?.preview?.warnings.length" class="preview-warnings">
        <li v-for="warning in selected.file.preview.warnings" :key="warning">{{ warning }}</li>
      </ul>
      <div v-if="selected.file?.preview?.matches.length" class="recording-matches">
        <h3>同名歌曲</h3>
        <article v-for="match in selected.file.preview.matches" :key="match.id">
          <div>
            <RouterLink :to="`/songs/${match.id}`" class="text-link">{{ match.name }}</RouterLink>
            <p class="hint">
              {{ match.artists.map((artist) => artist.name).join(' / ') || '未知歌手' }} ·
              {{ match.albums.map((album) => album.name).join(' / ') || '单曲' }} ·
              {{ match.recording_version || '未标注版本' }} ·
              {{ match.duration ? duration(match.duration) : '暂无音频' }}
            </p>
            <p v-if="match.different_recording" class="task-warning">
              时长相差约 {{ Math.round(match.duration_difference || 0) }} 秒，请核对录音版本。
            </p>
          </div>
          <button v-if="!previewOnly" class="button small secondary" @click="chooseSong(match)">
            关联这首
          </button>
        </article>
      </div>
      <template v-if="!previewOnly">
        <label
          >搜索已有歌曲
          <div class="search-inline">
            <input v-model="query" @keydown.enter.prevent="search" /><button
              :disabled="busy"
              class="button secondary"
              @click="search"
            >
              搜索
            </button>
          </div></label
        >
        <div class="picker-results">
          <button
            v-for="c in candidates"
            :key="c.id"
            :class="{ selected: song?.id === c.id }"
            @click="song = c"
          >
            <strong>{{ c.name }}</strong><small
              >{{ c.artists?.map((a) => a.name).join(' / ') }} ·
              {{ c.recording_version || '未标注版本' }} ·
              {{ c.albums?.map((album) => album.name).join(' / ') || '单曲' }}</small
            >
          </button>
        </div>
        <p v-if="song" class="notice">
          已选：{{ song.name }}
          {{ song.recording_version ? `（${song.recording_version}）` : '' }}
        </p>
        <p class="hint">请核对歌手、专辑和版本。同名不代表同一首录音。</p>
      </template>
    </div>
    <template #footer
      ><button :disabled="busy" class="button secondary" @click="confirm = false">
        {{ previewOnly ? '关闭' : '稍后处理' }}</button
      ><button
        v-if="!previewOnly"
        :disabled="busy || !song"
        class="button primary"
        @click="publish"
      >
        {{ busy ? '正在保存…' : '确认加入曲库' }}
      </button></template
    ></BaseDialog
  >
  <UploadBatchDialog
    :batch="batch"
    @inspect="inspectPicture"
    @preview="open($event, true)"
    @browse-images="browseImages"
  />
</template>

<style scoped>
.task-thumbnail {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 5px;
  overflow: hidden;
  background: var(--surface-muted);
}
.task-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.folder-audio {
  max-height: 180px;
  overflow-y: auto;
  margin-top: 8px;
  padding-left: 20px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.task-warning {
  margin-top: 5px;
  color: var(--warning);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.parsed-preview {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.parsed-cover {
  width: 96px;
  height: 96px;
  flex-shrink: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  object-fit: cover;
}
.parsed-cover.placeholder {
  display: grid;
  place-items: center;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 30px;
}
.parsed-details {
  min-width: 0;
}
.parsed-details > strong {
  display: block;
  margin-bottom: 5px;
  overflow-wrap: anywhere;
}
.parsed-lyrics {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}
.preview-warnings {
  margin: 0;
  padding: 10px 12px 10px 28px;
  border: 1px solid var(--warning-line);
  border-radius: 8px;
  background: var(--warning-veil);
  color: var(--warning);
  font-size: 12px;
  line-height: 1.7;
  list-style: disc;
}
.recording-matches {
  display: grid;
  gap: 8px;
}
.recording-matches article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
}
.recording-matches article > div {
  min-width: 0;
}
.notice-panel {
  padding: 20px;
  margin-bottom: 16px;
}
.notice-panel .preline {
  margin: 12px 0;
  color: var(--text-muted);
  font-size: 13px;
}
.notice-panel > .button {
  margin-top: 12px;
}
.upload-drop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  padding: 26px 22px;
  margin-bottom: 18px;
  border: 1px dashed var(--brand-line-strong);
  border-radius: 8px;
  background: var(--brand-tint);
}
.upload-drop.compact {
  padding: 14px 16px;
}
.upload-drop.over {
  border-color: var(--brand);
  background: var(--brand-tint-strong);
}
.drop-copy strong {
  font-size: 14px;
}
.drop-copy p {
  margin-top: 3px;
}
.upload-drop label {
  cursor: pointer;
}
.upload-drop label:focus-within {
  outline: 2px solid var(--brand);
  outline-offset: 3px;
}
.task-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 30px;
  flex-shrink: 0;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 4px;
  font-size: 16px;
}
.task-icon.done {
  background: var(--success-soft);
  color: var(--success);
}
.pending-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}
.pending-row:last-child {
  border: 0;
}
.pending-row > div {
  min-width: 0;
  flex: 1;
}
.pending-row strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.pending-note {
  padding: 14px;
}
.notice-details {
  margin-top: 18px;
  color: var(--text-muted);
  font-size: 12px;
}
.notice-details summary {
  width: fit-content;
  cursor: pointer;
}
.notice-details p {
  margin-top: 10px;
}
@media (max-width: 680px) {
  .parsed-preview {
    gap: 12px;
  }
  .parsed-cover {
    width: 72px;
    height: 72px;
  }
  .upload-drop,
  .upload-drop.compact {
    padding: 16px;
  }
  .task-icon,
  .task-thumbnail {
    grid-column: 1;
    grid-row: 1;
  }
  .task-thumbnail {
    width: 26px;
    height: 30px;
  }
  .pending-row {
    padding: 10px;
    gap: 8px;
  }
}
</style>
