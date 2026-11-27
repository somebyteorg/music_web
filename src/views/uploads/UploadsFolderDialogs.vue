<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import { inject } from 'vue'
import { uploadsContextKey } from './uploadsContext'

const context = inject(uploadsContextKey)
if (!context) throw new Error('上传页缺少上下文（uploadsContextKey）')
const { source } = context
const { folderUpload, folderBusy, confirmFolder } = source
</script>
<template>
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
      <Button
        :disabled="folderBusy"
        variant="secondary"
        type="button"
        @click="folderUpload.open = false"
      >
        取消
      </Button>
      <Button
        :disabled="folderBusy || (!folderUpload.audio.length && !folderUpload.selected.length)"
        variant="primary"
        type="button"
        @click="confirmFolder"
      >
        {{
          folderBusy
            ? '正在加入队列…'
            : `上传 ${folderUpload.audio.length} 份音频和 ${folderUpload.selected.length} 张图片`
        }}
      </Button>
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
      ><Button variant="secondary" type="button" @click="folderUpload.preview = undefined">
        关闭</Button
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
</template>
<style scoped>
.folder-audio {
  max-height: 180px;
  overflow-y: auto;
  margin-top: 8px;
  padding-left: 20px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>
