<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import Pagination from '@/components/Pagination.vue'
import { inject } from 'vue'
import { fileUrl } from '@/utils/file'
import { uploadsContextKey } from './uploadsContext'

const context = inject(uploadsContextKey)
if (!context) throw new Error('上传页缺少上下文（uploadsContextKey）')
const { images: imageLibrary, batch } = context
const { images, imageAlbum, imageTask, selectImage, removePreviewTask, selectPreview } =
  imageLibrary
</script>
<template>
  <BaseDialog v-model="images.open" :title="imageAlbum ? '从我的图片选择' : '我的图片'" wide>
    <div :aria-busy="images.busy" class="form-stack">
      <form class="search-inline" @submit.prevent="images.load(1)">
        <input
          v-model="images.query"
          aria-label="搜索我的图片"
          placeholder="搜索图片文件名"
        /><Button :disabled="images.busy" variant="secondary">搜索</Button>
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
          <TextButton
            v-if="imageAlbum"
            :disabled="images.busy || batch.busy"
            @click="selectImage(file)"
          >
            选为正面图
          </TextButton>
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
      ><Button variant="secondary" type="button" @click="images.open = false"
        >关闭</Button
      ></template
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
      <Button
        :disabled="images.previewBusy"
        variant="secondary"
        type="button"
        @click="images.previewOpen = false"
      >
        关闭
      </Button>
      <TextButton
        v-if="images.preview?.file"
        :disabled="
          images.previewBusy || !!images.previewError || !!images.references.length || batch.busy
        "
        variant="danger"
        @click="images.confirmDelete ? images.remove() : (images.confirmDelete = true)"
      >
        {{ images.confirmDelete ? '确认删除' : '删除图片' }}
      </TextButton>
      <TextButton
        v-if="imageTask && !imageTask.transfer.file && images.preview?.url"
        variant="danger"
        @click="removePreviewTask"
      >
        移除上传任务
      </TextButton>
      <Button
        v-if="imageAlbum && images.preview"
        :disabled="images.previewBusy || batch.busy"
        variant="primary"
        type="button"
        @click="selectPreview"
      >
        选为正面图
      </Button>
    </template>
  </BaseDialog>
</template>
