<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { fileUrl } from '@/utils/file'
import EntityCover from '@/components/EntityCover.vue'
import EditorImagePicker from './EditorImagePicker.vue'
import { useEditorContext } from './editorContext'

const { editor, props: editorProps } = useEditorContext()
const {
  artwork,
  busy,
  uploading,
  form,
  images,
  coverInput,
  coverError,
  coverMessage,
  coverSource,
  cover,
} = editor
</script>

<template>
  <div class="cover-editor">
    <button
      :disabled="!coverSource"
      aria-label="预览当前封面"
      class="cover-preview-button"
      type="button"
      @click="
        images.inspect({
          id: form.cover_id || editorProps.item?.id || '',
          name: '当前封面',
          url: coverSource || undefined,
        })
      "
    >
      <EntityCover
        :item="{
          id: editorProps.item?.id || '',
          name: form.name,
          cover_id: form.cover_id,
          image_url: editorProps.item?.image_url,
        }"
        :source="coverSource"
      />
    </button>
    <div>
      <Button
        variant="secondary"
        :disabled="busy || uploading"
        type="button"
        @click="coverInput?.click()"
      >
        {{ uploading ? '正在上传…' : '上传封面' }}
      </Button>
      <input
        ref="coverInput"
        :disabled="busy || uploading"
        accept="image/jpeg,image/png,image/webp"
        aria-label="选择封面图片"
        class="sr-only"
        tabindex="-1"
        type="file"
        @change="cover"
      />
      <TextButton v-if="form.cover_id" @click="form.cover_id = null"> 移除自定义封面 </TextButton>
      <p class="hint">支持 JPG、PNG、WebP</p>
      <TextButton :disabled="busy || uploading" @click="images.show"> 从我的图片选择 </TextButton>
    </div>
  </div>
  <p v-if="coverError" class="notice error" role="alert">{{ coverError }}</p>
  <p v-if="coverMessage" class="hint" role="status">{{ coverMessage }}</p>
  <div v-if="editorProps.type === 'albums' && artwork.length" class="form-stack">
    <p class="hint">专辑附图 · 移除后保存资料生效。</p>
    <div class="image-grid">
      <article v-for="picture in artwork" :key="picture.file_id" class="image-card">
        <button
          aria-label="预览专辑附图"
          class="image-thumbnail"
          type="button"
          @click="images.inspect({ id: picture.file_id, name: '专辑附图' })"
        >
          <img :src="fileUrl(picture.file_id)" alt="" loading="lazy" />
        </button>
        <span>{{
          { cover: '正面图', back: '封底', disc: '碟面', booklet: '内页', other: '其他图片' }[
            picture.type
          ]
        }}</span>
        <TextButton
          :disabled="busy || uploading"
          @click="artwork = artwork.filter((item) => item.file_id !== picture.file_id)"
        >
          移除附图
        </TextButton>
      </article>
    </div>
  </div>
  <EditorImagePicker v-if="images.open" />
</template>

<style scoped>
@layer components {
  .cover-editor {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .cover-preview-button {
    width: 72px;
    flex-shrink: 0;
  }
  .cover-editor .text-button {
    display: block;
    font-size: 12px;
  }
  .cover-editor .hint {
    margin-top: 4px;
  }
}
</style>
