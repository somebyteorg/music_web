<script lang="ts" setup>
import BaseDialog from '@/components/BaseDialog.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { fileUrl } from '@/utils/file'
import { useEditorContext } from './editorContext'

const { editor } = useEditorContext()
const { busy, uploading, images, selectCover } = editor
</script>

<template>
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
      <Button
        variant="secondary"
        :disabled="images.previewBusy"
        type="button"
        @click="images.previewOpen = false"
      >
        关闭
      </Button>
      <TextButton
        v-if="images.preview?.file"
        :disabled="
          images.previewBusy ||
          !!images.previewError ||
          !!images.references.length ||
          busy ||
          uploading
        "
        variant="danger"
        @click="images.confirmDelete ? images.remove() : (images.confirmDelete = true)"
      >
        {{ images.confirmDelete ? '确认删除' : '删除图片' }}
      </TextButton>
      <Button
        variant="primary"
        v-if="images.preview?.file"
        :disabled="images.previewBusy || busy || uploading"
        type="button"
        @click="selectCover(images.preview.file)"
      >
        用作封面
      </Button>
    </template>
  </BaseDialog>
</template>
