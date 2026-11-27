<script lang="ts" setup>
import { useSignStore } from '@/stores/sign'

const sign = useSignStore()
</script>
<template>
  <details class="notice-details">
    <summary>上传说明与须知</summary>
    <p>
      选择文件夹后，先预览并确认要上传的图片。默认勾选 Cover、Front、Folder
      等名称的封面图。大图片会先生成压缩副本再上传，原图保留。上传完成后，确认专辑和歌曲信息，再加入曲库。
    </p>
    <p class="preline">{{ sign.config?.notice.text }}</p>
  </details>
</template>
<style scoped>
.notice-details {
  margin-top: 18px;
  color: var(--text-muted);
  font-size: 12px;
}
.notice-details summary {
  width: fit-content;
  cursor: pointer;
}
.notice-details p {
  margin-top: 10px;
}
</style>
