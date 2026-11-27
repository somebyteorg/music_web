<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import Tag from '@/components/ui/Tag.vue'
import { computed, inject } from 'vue'
import { fileUrl } from '@/utils/file'
import { bytes, duration, qualities } from '@/utils/format'
import { lyricFormats } from '@/features/catalog/useSongLyrics'
import type { UploadTask } from '@/features/uploads/model'
import { uploadsContextKey } from './uploadsContext'

const context = inject(uploadsContextKey)
if (!context) throw new Error('上传页缺少上下文（uploadsContextKey）')
const { uploads, preview, busy } = context
const { selected, confirm, previewOnly, query, candidates, song, search, chooseSong, publish } =
  preview

const selectedFile = computed(() => selected.value?.transfer.file)
function previewCover(task: UploadTask) {
  const file = task.transfer.file
  const id = task.kind === 'cover' ? file?.id : file?.preview?.cover_id
  return id ? fileUrl(id) : uploads.localCover(task)
}
</script>
<template>
  <BaseDialog v-model="confirm" :busy="busy" :title="previewOnly ? '解析结果预览' : '确认歌曲归属'"
    ><div v-if="selected" class="form-stack">
      <p class="hint">
        {{ selected.name }}
        <span v-if="selectedFile">· {{ qualities[selectedFile.quality] }}</span>
      </p>
      <div v-if="selectedFile" class="parsed-preview">
        <img
          v-if="previewCover(selected)"
          :alt="`${selected.metadata.title} 封面`"
          :src="previewCover(selected)"
          class="parsed-cover"
        />
        <div v-else aria-hidden="true" class="parsed-cover placeholder">♫</div>
        <div class="parsed-details">
          <strong>{{ selected.metadata.title }}</strong>
          <p class="hint">
            {{ selected.metadata.artist || '未识别歌手' }} ·
            {{ selected.metadata.album || '未识别专辑' }}
          </p>
          <p v-if="selected.kind === 'audio'" class="hint">
            {{ selectedFile.codec.toUpperCase() }} · {{ selectedFile.sample_rate / 1000 }} kHz<span
              v-if="selectedFile.bit_depth"
            >
              / {{ selectedFile.bit_depth }} bit</span
            >
            · {{ duration(selectedFile.duration) }} ·
            {{ bytes(selectedFile.file_size) }}
          </p>
          <div v-if="selectedFile.preview?.lyrics.length" class="parsed-lyrics">
            <Tag v-for="(lyric, index) in selectedFile.preview.lyrics" :key="index" variant="brand"
              >{{ lyricFormats.find((format) => format.value === lyric.format)?.label }} ·
              {{ lyric.language }}</Tag
            >
          </div>
          <p v-else-if="selected.kind === 'audio'" class="hint">没有内嵌歌词，可在歌曲页补充。</p>
        </div>
      </div>
      <ul v-if="selectedFile?.preview?.warnings.length" class="preview-warnings">
        <li v-for="warning in selectedFile.preview.warnings" :key="warning">
          {{ warning }}
        </li>
      </ul>
      <div v-if="selectedFile?.preview?.matches.length" class="recording-matches">
        <h3>同名歌曲</h3>
        <article v-for="match in selectedFile.preview.matches" :key="match.id">
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
          <Button v-if="!previewOnly" variant="secondary" size="sm" @click="chooseSong(match)">
            关联这首
          </Button>
        </article>
      </div>
      <template v-if="!previewOnly">
        <label
          >搜索已有歌曲
          <div class="search-inline">
            <input v-model="query" @keydown.enter.prevent="search" /><Button
              :disabled="busy"
              variant="secondary"
              @click="search"
            >
              搜索
            </Button>
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
      ><Button :disabled="busy" variant="secondary" @click="confirm = false">
        {{ previewOnly ? '关闭' : '稍后处理' }}</Button
      ><Button v-if="!previewOnly" :disabled="busy || !song" variant="primary" @click="publish">
        {{ busy ? '正在保存…' : '确认加入曲库' }}
      </Button></template
    ></BaseDialog
  >
</template>
<style scoped>
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
  color: var(--warning-note);
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
.task-warning {
  margin-top: 5px;
  color: var(--warning-task);
  font-size: 12px;
  overflow-wrap: anywhere;
}
@media (max-width: 680px) {
  .parsed-preview {
    gap: 12px;
  }
  .parsed-cover {
    width: 72px;
    height: 72px;
  }
}
</style>
