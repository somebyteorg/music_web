<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import type { UploadBatch } from './useUploadBatch'
import type { BatchAlbum } from './batchModel'
import type { UploadTask } from './model'
import UploadBatchTrackRows from './UploadBatchTrackRows.vue'
import { useAlbumField } from './batchField'

const props = defineProps<{ batch: UploadBatch; album: BatchAlbum }>()
const trackStart = useAlbumField(props.batch, props.album, 'trackStart')
const moveTo = useAlbumField(props.batch, props.album, 'moveTo')
const emit = defineEmits<{ preview: [task: UploadTask] }>()
</script>
<template>
  <div
    v-if="
      album.selection &&
      album.selection !== 'none' &&
      batch.groupEntries(album).some(({ task }) => task.state === 'ready')
    "
    class="track-numbering"
  >
    <p class="hint">缺失或重复的曲序会自动补齐；已有曲目保留原位，同一首歌的多种音质共用曲序。</p>
    <div class="track-numbering-actions">
      <label class="batch-number"
        >起始曲序<input
          v-model.number="trackStart"
          type="number"
          min="1"
          max="9999"
          :disabled="batch.busy || batch.numbering.includes(album.key)"
      /></label>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        :disabled="batch.busy || batch.numbering.includes(album.key)"
        @click="batch.numberTracks(album)"
      >
        {{ batch.numbering.includes(album.key) ? '正在检查曲序…' : '从此曲序重新递增' }}
      </Button>
      <TextButton
        :disabled="batch.busy || batch.numbering.includes(album.key)"
        @click="batch.numberTracks(album, false)"
      >
        只补齐缺失和重复
      </TextButton>
      <TextButton v-if="batch.canUndoNumbers(album)" @click="batch.undoNumbers(album)">
        撤销本次编号
      </TextButton>
    </div>
    <p class="hint">重新编号按下方文件顺序排列，每张碟分别递增，并跳过已有位置。</p>
  </div>
  <p v-if="batch.numberingErrors[album.key]" class="error-text" role="alert">
    {{ batch.numberingErrors[album.key] }}
  </p>
  <p v-for="problem in batch.problems(album)" :key="problem" class="error-text">
    {{ problem }}
  </p>
  <p
    v-if="
      (album.applyArtist || batch.form.applyArtist) &&
      batch
        .groupEntries(album)
        .some(({ row }) => !row.choice.startsWith('track:') && !batch.songArtist(row))
    "
    class="error-text"
  >
    请填写统一使用的歌手，或取消统一填写。
  </p>
  <p v-if="batch.groupEntries(album).length" class="hint group-track-preview">
    {{
      batch
        .groupEntries(album)
        .slice(0, 3)
        .map(({ row }) => row.title)
        .join('、')
    }}{{ batch.groupEntries(album).length > 3 ? '…' : '' }}
  </p>
  <p v-else class="hint">分组已建好，可展开其他分组的曲目，或整组移动音频到这里。</p>
  <UploadBatchTrackRows :album="album" :batch="batch" @preview="emit('preview', $event)" />
  <div v-if="batch.albums.length > 1 && batch.groupEntries(album).length" class="group-move">
    <BaseSelect
      v-model="moveTo"
      :options="[
        { value: '', label: '移入其他分组…' },
        ...batch.groupOptions.filter((option) => option.value !== album.key),
      ]"
      :disabled="batch.busy || batch.done > 0"
      :label="`${batch.groupTitle(album)} 的目标分组`"
    />
    <TextButton
      :disabled="batch.busy || batch.done > 0 || !album.moveTo"
      @click="batch.moveGroup(album)"
    >
      移动整组音频
    </TextButton>
  </div>
  <TextButton
    v-if="!batch.groupEntries(album).length"
    :disabled="batch.busy"
    @click="batch.removeEmptyGroup(album)"
  >
    移除空分组
  </TextButton>
</template>
<style scoped>
.track-numbering {
  display: grid;
  gap: 8px;
}
.track-numbering-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
}
.track-numbering-actions > label {
  width: 100px;
  font-size: 12px;
}
.group-move {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.group-move > .select-control {
  flex: 1;
  min-width: min(100%, 180px);
}
.group-track-preview {
  overflow-wrap: anywhere;
}
</style>
