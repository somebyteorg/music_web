<script lang="ts" setup>
import UploadQueue from '@/features/uploads/UploadQueue.vue'
import { computed, onMounted, provide, reactive } from 'vue'
import { useUploadsStore } from '@/stores/uploads'
import { usePendingUploads } from '@/features/uploads/usePendingUploads'
import { useUploadBatch } from '@/features/uploads/useUploadBatch'
import { useUploadImages } from '@/features/uploads/useUploadImages'
import { useUploadPreview } from '@/features/uploads/useUploadPreview'
import { useUploadSource } from '@/features/uploads/useUploadSource'
import UploadsHeader from './uploads/UploadsHeader.vue'
import UploadsPendingSection from './uploads/UploadsPendingSection.vue'
import UploadsNoticeDetails from './uploads/UploadsNoticeDetails.vue'
import UploadsFolderDialogs from './uploads/UploadsFolderDialogs.vue'
import UploadsImageDialogs from './uploads/UploadsImageDialogs.vue'
import UploadsPreview from './uploads/UploadsPreview.vue'
import UploadsBatchSection from './uploads/UploadsBatchSection.vue'
import { uploadsContextKey } from './uploads/uploadsContext'

const uploads = useUploadsStore()
const pending = usePendingUploads()
const batch = reactive(useUploadBatch(pending.loadPending))
const images = useUploadImages(batch)
const source = useUploadSource()
const preview = useUploadPreview(batch.show, pending.loadPending)
const busy = computed(() => source.busy.value || preview.busy.value)

// 页面只负责组合与接线，状态的唯一归属仍在这里
provide(uploadsContextKey, { uploads, source, pending, batch, images, preview, busy })
onMounted(pending.loadPending)
</script>
<template>
  <UploadsHeader />
  <UploadQueue
    :organizing="batch.busy"
    @inspect="images.inspectTask"
    @organize="batch.show"
    @preview="preview.open"
  />
  <UploadsPendingSection />
  <UploadsNoticeDetails />
  <UploadsFolderDialogs />
  <UploadsImageDialogs />
  <UploadsPreview />
  <UploadsBatchSection />
</template>
