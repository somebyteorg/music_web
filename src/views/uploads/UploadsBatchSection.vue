<script lang="ts" setup>
import UploadBatchDialog from '@/features/uploads/UploadBatchDialog.vue'
import { inject } from 'vue'
import { uploadsContextKey } from './uploadsContext'

const context = inject(uploadsContextKey)
if (!context) throw new Error('上传页缺少上下文（uploadsContextKey）')
const { batch, images, preview } = context
const { inspectPicture, browseImages } = images
const { open } = preview
</script>
<template>
  <UploadBatchDialog
    v-model:open="batch.open"
    v-model:libraryId="batch.form.libraryId"
    v-model:applyArtist="batch.form.applyArtist"
    v-model:artist="batch.form.artist"
    v-model:applyVersion="batch.form.applyVersion"
    v-model:version="batch.form.version"
    :batch="batch"
    @inspect="inspectPicture"
    @preview="open($event, true)"
    @browse-images="browseImages"
  />
</template>
