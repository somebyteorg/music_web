<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import Pagination from '@/components/Pagination.vue'
import { fileUrl } from '@/utils/file'
import { useEditorContext } from './editorContext'

const { editor } = useEditorContext()
const { busy, uploading, form, images, selectCover } = editor
</script>

<template>
  <div :aria-busy="images.busy" class="form-stack">
    <div class="search-inline">
      <input
        v-model="images.query"
        aria-label="搜索我的图片"
        placeholder="搜索图片文件名"
        @keydown.enter.prevent="images.load(1)"
      />
      <Button variant="secondary" :disabled="images.busy" type="button" @click="images.load(1)">
        搜索
      </Button>
      <TextButton @click="images.open = false">收起</TextButton>
    </div>
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
        <TextButton :disabled="busy || uploading || images.busy" @click="selectCover(file)">
          {{ form.cover_id === file.id ? '当前已选' : '用作封面' }}
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
</template>
