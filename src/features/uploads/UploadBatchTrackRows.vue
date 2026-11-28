<script lang="ts" setup>
import BaseSelect from '@/components/BaseSelect.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { duration, qualities } from '@/utils/format'
import type { UploadBatch } from './useUploadBatch'
import type { BatchAlbum } from './batchModel'
import type { UploadTask } from './model'

defineProps<{ batch: UploadBatch; album: BatchAlbum }>()
const emit = defineEmits<{ preview: [task: UploadTask] }>()
</script>
<template>
  <details
    v-if="batch.groupEntries(album).length"
    class="batch-details"
    :open="batch.groupEntries(album).some(({ row, task }) => !row.title.trim() || !!task.error)"
  >
    <summary>曲目与逐首编辑（{{ batch.groupEntries(album).length }} 份）</summary>
    <fieldset :disabled="batch.busy" class="batch-files">
      <article
        v-for="entry in batch.groupEntries(album)"
        :key="entry.row.taskId"
        class="batch-file"
      >
        <div class="batch-file-heading">
          <strong>{{ entry.task.name }}</strong><span class="hint"
            >{{ entry.task.transfer.file ? qualities[entry.task.transfer.file.quality] : '' }} ·
            {{ duration(entry.task.metadata.duration || 0)
            }}<template v-if="entry.task.state === 'published'"> · 已加入</template></span
          ><TextButton @click="emit('preview', entry.task)"> 解析预览 </TextButton>
        </div>
        <div class="batch-file-fields">
          <label
            >歌曲名<input
              v-model="entry.row.title"
              :disabled="entry.row.choice.startsWith('track:') || entry.task.state === 'published'"
              maxlength="255"
              required
          /></label>
          <span v-if="entry.row.matches.length" class="field-label"
            >加入方式<BaseSelect
              v-model="entry.row.choice"
              :disabled="entry.task.state === 'published'"
              :label="`${entry.task.name} 的歌曲归属`"
              :options="batch.options(entry.row)"
              @update:model-value="batch.choose(entry.task, entry.row)"
          /></span>
          <span v-else class="field-label"
            >加入方式<span class="batch-static hint">新建歌曲</span></span
          >
          <span v-if="batch.albums.length > 1" class="field-label"
            >专辑分组<BaseSelect
              :model-value="entry.row.albumKey"
              :disabled="entry.task.state === 'published'"
              :label="`${entry.task.name} 的专辑分组`"
              :options="batch.groupOptions"
              @update:model-value="batch.moveRow(entry.row, $event)"
          /></span>
          <label
            >歌曲演唱者<input
              :value="batch.songArtist(entry.row)"
              @input="entry.row.artist = ($event.target as HTMLInputElement).value"
              :disabled="
                batch.form.applyArtist ||
                album.applyArtist ||
                entry.row.choice.startsWith('track:') ||
                entry.task.state === 'published'
              "
              maxlength="255"
          /></label>
          <label
            >录音版本<input
              :value="batch.songVersion(entry.row)"
              @input="entry.row.version = ($event.target as HTMLInputElement).value"
              :disabled="
                batch.form.applyVersion ||
                entry.row.choice.startsWith('track:') ||
                entry.task.state === 'published'
              "
              :placeholder="
                batch.form.applyVersion ? batch.form.version || '统一留空' : '未标注版本'
              "
              maxlength="100"
          /></label>
          <label class="batch-number"
            >碟号<input
              v-model.number="entry.row.disc"
              :disabled="entry.task.state === 'published'"
              max="999"
              min="1"
              type="number"
          /></label>
          <label class="batch-number"
            >曲序<input
              v-model.number="entry.row.track"
              :disabled="entry.task.state === 'published'"
              max="9999"
              min="1"
              type="number"
          /></label>
        </div>
        <p
          v-if="
            entry.row.matches.some(
              (match) => entry.row.choice.endsWith(match.id) && match.different_recording,
            )
          "
          class="task-warning"
        >
          所选歌曲的音频时长与本文件不同，请确认属于同一录音版本。
        </p>
        <p v-else-if="entry.task.transfer.file?.preview?.warnings.length" class="hint">
          {{ entry.task.transfer.file.preview.warnings.join(' ') }}
        </p>
        <TextButton
          :disabled="batch.busy || entry.row.searching"
          @click="batch.searchTracks(entry.task, entry.row)"
        >
          {{ entry.row.searching ? '正在查找…' : '查找已有曲目／录音' }}
        </TextButton>
        <p v-if="entry.task.error" class="error-text">{{ entry.task.error }}</p>
      </article>
    </fieldset>
  </details>
</template>
<style scoped>
@layer components {
  .batch-details > summary {
    cursor: pointer;
    color: var(--brand-strong);
    font-size: 12px;
    font-weight: 550;
  }
  .batch-details[open] > summary {
    margin-bottom: 14px;
  }
  .task-warning {
    margin-top: 5px;
    color: var(--warning-task);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .batch-files {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .batch-file {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .batch-file-heading {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px 12px;
    margin-bottom: 12px;
  }
  .batch-file-heading > strong {
    min-width: 0;
    flex: 1;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .batch-file-heading > .hint {
    font-size: 11px;
  }
  .batch-file-fields {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 8px;
  }
  .batch-file-fields > label:first-child,
  .batch-file-fields > label:nth-child(2),
  .batch-file-fields > .field-label:first-child,
  .batch-file-fields > .field-label:nth-child(2) {
    grid-column: span 2;
  }
  .batch-file-fields > label,
  .batch-file-fields > .field-label {
    min-width: 0;
    font-size: 12px;
  }
  .batch-static {
    display: flex;
    align-items: center;
    min-height: 40px;
  }
  @media (max-width: 680px) {
    .batch-file-fields {
      grid-template-columns: 1fr 1fr;
    }
    .batch-file-fields > label:nth-child(-n + 3) {
      grid-column: 1 / -1;
    }
    .batch-file {
      padding: 12px;
    }
  }
}
</style>
