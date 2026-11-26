<script lang="ts" setup>
import BaseSelect from '@/components/BaseSelect.vue'
import { fileUrl } from '@/utils/file'
import type { UploadBatch } from './useUploadBatch'
import type { BatchAlbum } from './batchModel'
import { useAlbumField } from './batchField'

const props = defineProps<{ batch: UploadBatch; album: BatchAlbum }>()
const coverChoice = useAlbumField(props.batch, props.album, 'coverChoice')
const replaceCover = useAlbumField(props.batch, props.album, 'replaceCover')
const includeArtwork = useAlbumField(props.batch, props.album, 'includeArtwork')
const excludedPictureIds = useAlbumField(props.batch, props.album, 'excludedPictureIds')
const emit = defineEmits<{
  'browse-images': [album: BatchAlbum]
  inspect: [picture: ReturnType<UploadBatch['pictures']>[number], album: BatchAlbum]
}>()
</script>
<template>
  <details v-if="album.selection && album.selection !== 'none'" class="batch-details">
    <summary>封面与附图</summary>
    <div class="form-stack">
      <label
        >{{ batch.selectedAlbum(album) && !album.replaceCover ? '补充图片中的正面图' : '专辑封面'
        }}<BaseSelect
          v-model="coverChoice"
          :disabled="batch.busy"
          :label="`${album.name} 的封面`"
          :options="batch.coverOptions(album)"
      /></label>
      <label
        v-if="batch.selectedAlbum(album)?.cover_id || batch.selectedAlbum(album)?.image_url"
        class="check-label"
        ><input
          v-model="replaceCover"
          :disabled="batch.busy"
          type="checkbox"
        />替换已有专辑封面</label
      >
      <p v-if="batch.selectedAlbum(album)" class="hint">
        {{
          album.replaceCover
            ? '入库时使用所选图片替换专辑封面。'
            : '保留当前封面；所选图片作为附图补充。'
        }}
      </p>
      <label class="check-label"
        ><input
          v-model="includeArtwork"
          :disabled="batch.busy"
          type="checkbox"
        />包含目录中的封底、碟面和内页</label
      >
      <p v-if="batch.assetsLoading" class="hint">正在加载目录图片…</p>
      <p v-if="batch.assetsError" class="error-text" role="alert">
        {{ batch.assetsError }}
        <button
          :disabled="batch.assetsLoading"
          class="text-button"
          type="button"
          @click="batch.hydratePictures"
        >
          重试
        </button>
      </p>
      <div class="image-grid">
        <article
          v-for="picture in batch.pictures(album)"
          :key="picture.id"
          :class="{ selected: batch.pictureId(album) === picture.id }"
          class="image-card"
        >
          <button
            :aria-label="`预览 ${picture.name}`"
            :disabled="picture.waiting || batch.busy"
            class="image-thumbnail"
            type="button"
            @click="emit('inspect', picture, album)"
          >
            <img v-if="!picture.waiting" :src="fileUrl(picture.id)" alt="" loading="lazy" /><span
              v-else
              >等待上传</span
            >
          </button>
          <span :title="picture.name">{{ picture.name }}</span>
          <div class="button-group">
            <button
              :disabled="picture.waiting || batch.busy"
              class="text-button"
              type="button"
              @click="coverChoice = picture.id"
            >
              {{
                batch.pictureId(album) === picture.id ? '已选正面图' : '选为正面图'
              }}</button><button
              :disabled="batch.busy || picture.waiting"
              class="text-button"
              type="button"
              @click="batch.removePicture(album, picture.id)"
            >
              移除
            </button>
          </div>
        </article>
      </div>
      <p v-if="album.excludedPictureIds.length" class="hint">
        已移除 {{ album.excludedPictureIds.length }} 张候选图，文件仍保留。<button
          :disabled="batch.busy"
          class="text-button"
          type="button"
          @click="excludedPictureIds = []"
        >
          恢复候选图
        </button>
      </p>
      <button
        :disabled="batch.busy"
        class="text-button"
        type="button"
        @click="emit('browse-images', album)"
      >
        从我的图片选择
      </button>
      <label class="text-link album-cover-upload"
        >另选封面图片<input
          :disabled="batch.busy"
          accept="image/jpeg,image/png,image/webp"
          type="file"
          @change="batch.uploadCover(album, $event)"
      /></label>
    </div>
  </details>
</template>
<style scoped>
.batch-details > summary {
  cursor: pointer;
  color: var(--purple-dark);
  font-size: 12px;
  font-weight: 550;
}
.batch-details[open] > summary {
  margin-bottom: 14px;
}
.album-artwork {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.album-artwork .badge {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}
.album-cover-upload {
  position: relative;
  width: fit-content;
  cursor: pointer;
  font-size: 12px;
}
.album-cover-upload input {
  position: absolute;
  width: 100%;
  height: 100%;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
