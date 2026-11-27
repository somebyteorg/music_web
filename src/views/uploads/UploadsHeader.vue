<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import ButtonGroup from '@/components/ui/ButtonGroup.vue'
import Card from '@/components/ui/Card.vue'
import { inject, onBeforeUnmount, useTemplateRef, watchEffect } from 'vue'
import { useSignStore } from '@/stores/sign'
import { bytes } from '@/utils/format'
import { uploadsContextKey } from './uploadsContext'

const context = inject(uploadsContextKey)
if (!context) throw new Error('上传页缺少上下文（uploadsContextKey）')
const { uploads, source, pending, images, busy } = context
const sign = useSignStore()
const { targetSong, hasNotice, accepted, accept, isOverDropZone, choose, acceptNotice } = source
const { pendingTotal } = pending

// 拖拽区在这一层渲染，把模板 ref 交回给控制器（useDropZone 监听的就是它）
const dropZone = useTemplateRef<HTMLElement>('dropZone')
watchEffect(
  () => {
    source.dropZone.value = dropZone.value
  },
  { flush: 'post' },
)
onBeforeUnmount(() => {
  source.dropZone.value = null
})
</script>
<template>
  <div class="page-heading">
    <div class="heading-title">
      <h1>上传文件</h1>
      <span class="muted">{{ uploads.tasks.length }} 个任务</span>
    </div>
    <Button variant="secondary" type="button" @click="images.browseImages()">我的图片</Button>
  </div>
  <Card v-if="targetSong" as="section" class="notice-card">
    <p>
      为
      <RouterLink :to="`/songs/${targetSong.id}`" class="text-link">{{
        targetSong.name
      }}</RouterLink>
      上传音频<span v-if="targetSong.recording_version"> · {{ targetSong.recording_version }}</span>
    </p>
    <p class="hint">所选音频完成解析后会直接加入这首歌曲，请核对录音版本。</p>
  </Card>
  <Card v-if="!hasNotice" as="section" class="notice-card">
    <h2>上传须知</h2>
    <p class="preline">{{ sign.config?.notice.text }}</p>
    <label class="check-label"
      ><input v-model="accepted" type="checkbox" />我已阅读并同意上传须知</label
    ><Button :disabled="!accepted || busy" variant="primary" @click="acceptNotice">
      确认并开始上传
    </Button>
  </Card>
  <section
    v-else
    ref="dropZone"
    :class="[
      'upload-drop',
      { over: isOverDropZone, compact: uploads.tasks.length > 0 || pendingTotal > 0 },
    ]"
  >
    <div class="drop-copy">
      <strong>{{
        isOverDropZone ? '松开以添加文件，文件夹会先预览' : '拖入音频、封面或文件夹'
      }}</strong>
      <p class="hint">
        音频 ≤ {{ bytes(sign.config?.max_file_size || 0) }} · 封面 ≤
        {{ bytes(sign.config?.max_cover_size || 0) }} · 支持断点续传
      </p>
    </div>
    <ButtonGroup>
      <Button as="label" variant="primary"
        >＋ 添加文件<input
          :accept="accept"
          class="sr-only"
          multiple
          type="file"
          @change="choose" /></Button
      ><Button as="label" variant="secondary"
        >添加文件夹<input class="sr-only" multiple type="file" webkitdirectory @change="choose"
      /></Button>
    </ButtonGroup>
  </section>
</template>
<style scoped>
@layer components {
  .notice-card {
    padding: 20px;
    margin-bottom: 16px;
  }
  .notice-card .preline {
    margin: 12px 0;
    color: var(--text-muted);
    font-size: 13px;
  }
  .notice-card > .button {
    margin-top: 12px;
  }
  .upload-drop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px;
    padding: 26px 22px;
    margin-bottom: 18px;
    border: 1px dashed var(--brand-line-drop);
    border-radius: 8px;
    background: var(--brand-tint-row);
  }
  .upload-drop.compact {
    padding: 14px 16px;
  }
  .upload-drop.over {
    border-color: var(--brand);
    background: var(--brand-tint-deep);
  }
  .drop-copy strong {
    font-size: 14px;
  }
  .drop-copy p {
    margin-top: 3px;
  }
  .upload-drop label {
    cursor: pointer;
  }
  .upload-drop label:focus-within {
    outline: 2px solid var(--brand);
    outline-offset: 3px;
  }
  @media (max-width: 680px) {
    .upload-drop,
    .upload-drop.compact {
      padding: 16px;
    }
  }
}
</style>
