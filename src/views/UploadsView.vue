<script lang="ts" setup>
import UploadQueue from '@/features/uploads/UploadQueue.vue'
import { computed, onMounted, provide, reactive } from 'vue'
import { useUploadsStore } from '@/stores/uploads'
import { usePendingUploads } from '@/features/uploads/usePendingUploads'
import { useUploadBatch } from '@/features/uploads/useUploadBatch'
import { useUploadImages } from '@/features/uploads/useUploadImages'
import { useUploadPreview } from '@/features/uploads/useUploadPreview'
import { useUploadSource } from '@/features/uploads/useUploadSource'
import { useSignStore } from '@/stores/sign'
import { invalidateScopes } from '@/lib/query/keys'
import UploadsHeader from './uploads/UploadsHeader.vue'
import UploadsPendingSection from './uploads/UploadsPendingSection.vue'
import UploadsNoticeDetails from './uploads/UploadsNoticeDetails.vue'
import UploadsFolderDialogs from './uploads/UploadsFolderDialogs.vue'
import UploadsImageDialogs from './uploads/UploadsImageDialogs.vue'
import UploadsPreview from './uploads/UploadsPreview.vue'
import UploadsBatchSection from './uploads/UploadsBatchSection.vue'
import { uploadsContextKey } from './uploads/uploadsContext'

const uploads = useUploadsStore()
const sign = useSignStore()
const pending = usePendingUploads()
/** 入库完成：曲库列表与实体详情都变了，按前缀失效后再刷新待入库表 */
async function published() {
  invalidateScopes(sign.user?.id, ['catalog', 'detail', 'pending-uploads'])
  await pending.loadPending()
}
const batch = reactive(useUploadBatch(published))
const images = useUploadImages(batch)
const source = useUploadSource()
const preview = useUploadPreview(batch.show, published)
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
