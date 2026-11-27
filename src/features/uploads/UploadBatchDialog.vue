<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import ButtonGroup from '@/components/ui/ButtonGroup.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import type { UploadBatch } from './useUploadBatch'
import type { BatchAlbum } from './batchModel'
import type { UploadTask } from './model'
import UploadBatchAlbum from './UploadBatchAlbum.vue'
import UploadBatchPublish from './UploadBatchPublish.vue'

const props = defineProps<{ batch: UploadBatch }>()
const open = defineModel<boolean>('open', { required: true })
const libraryId = defineModel<string>('libraryId', { required: true })
const applyArtist = defineModel<boolean>('applyArtist', { required: true })
const artist = defineModel<string>('artist', { required: true })
const applyVersion = defineModel<boolean>('applyVersion', { required: true })
const version = defineModel<string>('version', { required: true })
const addingAlbum = ref(false)
const albumName = ref('')
const albumNameInput = useTemplateRef<HTMLInputElement>('albumNameInput')
const groupingOptions = [
  { value: 'folder' as const, label: '按文件夹分组' },
  { value: 'album' as const, label: '按专辑标签分组' },
]
function preventUnexpectedEnter(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLInputElement) || event.isComposing || event.keyCode === 229)
    return
  event.preventDefault()
  event.stopPropagation()
}
async function startAlbumGroup() {
  addingAlbum.value = true
  await nextTick()
  albumNameInput.value?.focus()
}
function confirmAlbumGroup() {
  if (props.batch.addAlbum(albumName.value)) {
    addingAlbum.value = false
    albumName.value = ''
  }
}
watch(open, () => {
  addingAlbum.value = false
  albumName.value = ''
})
const emit = defineEmits<{
  preview: [task: UploadTask]
  'browse-images': [album: BatchAlbum]
  inspect: [picture: ReturnType<UploadBatch['pictures']>[number], album: BatchAlbum]
}>()
</script>
<template>
  <BaseDialog v-model="open" :busy="batch.busy" title="批量整理音频" wide>
    <form class="form-stack" novalidate @submit.prevent @keydown.enter="preventUnexpectedEnter">
      <label
        >新建歌曲所属媒体库<BaseSelect
          v-model="libraryId"
          :disabled="batch.busy || batch.libraries.busy"
          :options="batch.libraries.options"
          label="上传歌曲所属媒体库"
      /></label>
      <p class="hint">关联已有歌曲时保留其媒体库，新增的专辑收录不会移除其他专辑关联。</p>
      <p v-if="batch.libraries.error" class="error-text">
        {{ batch.libraries.error }}
        <TextButton @click="batch.libraries.reload()">重试</TextButton>
      </p>
      <label
        >音频分组<BaseSelect
          :model-value="batch.grouping"
          :options="groupingOptions"
          :disabled="batch.busy || batch.done > 0"
          label="音频分组方式"
          @update:model-value="batch.regroup"
      /></label>
      <p class="hint">
        每组确认专辑归属即可入库。CD1、CD2
        等子目录会合在一起；切换分组保留歌曲信息，专辑归属请重新核对。
      </p>
      <fieldset :disabled="batch.busy" class="batch-common">
        <div>
          <label class="check-label"
            ><input v-model="applyArtist" type="checkbox" />统一歌曲演唱者</label
          ><input
            v-model="artist"
            :disabled="!batch.form.applyArtist"
            aria-label="批量填写歌曲演唱者"
            maxlength="255"
            placeholder="保留每首演唱者时无需勾选"
          />
        </div>
        <div>
          <label class="check-label"
            ><input v-model="applyVersion" type="checkbox" />统一录音版本</label
          ><input
            v-model="version"
            :disabled="!batch.form.applyVersion"
            aria-label="批量填写录音版本"
            maxlength="100"
            placeholder="现场、混音、重制等"
          />
        </div>
      </fieldset>
      <p class="hint">统一填写仅应用于新建歌曲；关联已有歌曲时保留原来的歌手和录音版本。</p>
      <UploadBatchAlbum
        v-for="album in batch.albums"
        :key="album.key"
        :album="album"
        :batch="batch"
        @browse-images="emit('browse-images', $event)"
        @inspect="(picture, target) => emit('inspect', picture, target)"
        @preview="emit('preview', $event)"
      />
      <div v-if="addingAlbum" class="new-group form-stack">
        <label
          >新专辑分组名称<input
            ref="albumNameInput"
            v-model="albumName"
            maxlength="255"
            :disabled="batch.busy"
            placeholder="填写专辑名称，再确认添加"
        /></label>
        <ButtonGroup>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            :disabled="batch.busy"
            @click="addingAlbum = false"
          >
            取消添加
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            :disabled="batch.busy || !albumName.trim()"
            @click="confirmAlbumGroup"
          >
            确认添加分组
          </Button>
        </ButtonGroup>
      </div>
      <TextButton v-else :disabled="batch.busy" @click="startAlbumGroup">
        ＋ 添加专辑分组
      </TextButton>
      <p v-if="batch.busy" class="notice" role="status">
        正在加入曲库：{{ batch.done }} / {{ batch.entries.length }} 份音频已完成。
      </p>
    </form>
    <template #footer>
      <UploadBatchPublish :batch="batch" @close="open = false" />
    </template>
  </BaseDialog>
</template>
<style scoped>
.batch-common {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  border: 0;
}
.batch-common > div {
  display: grid;
  gap: 8px;
}
.new-group {
  padding: 16px;
  border: 1px dashed var(--line);
  border-radius: 10px;
}
@media (max-width: 680px) {
  .batch-common {
    grid-template-columns: 1fr;
  }
}
</style>
