<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import ButtonGroup from '@/components/ui/ButtonGroup.vue'
import Card from '@/components/ui/Card.vue'
import TextButton from '@/components/ui/TextButton.vue'
import Pagination from '@/components/Pagination.vue'
import { inject } from 'vue'
import { fileUrl } from '@/utils/file'
import { bytes, qualities } from '@/utils/format'
import type { AudioFile } from '@/types/uploads'
import { uploadsContextKey } from './uploadsContext'

const context = inject(uploadsContextKey)
if (!context) throw new Error('上传页缺少上下文（uploadsContextKey）')
const { uploads, pending, batch, images, preview } = context
const { remotePending, pendingBusy, pendingPage, pendingTotal, pendingPageSize, loadPending } =
  pending
const { changePendingPage } = pending
const { inspectPending } = images

function fromPending(file: AudioFile) {
  void preview.open(uploads.adopt(file))
}
function batchPending() {
  batch.show(remotePending.value.map((file) => uploads.adopt(file)))
}
</script>
<template>
  <section v-if="pendingTotal" class="section">
    <div class="section-heading">
      <div class="heading-title">
        <h2>已上传、待确认的音频</h2>
        <span class="muted">{{ pendingTotal }} 份音频</span>
      </div>
      <ButtonGroup>
        <Button v-if="remotePending.length" variant="secondary" size="sm" @click="batchPending">
          批量整理本页</Button
        ><TextButton :disabled="pendingBusy" @click="loadPending">刷新</TextButton>
      </ButtonGroup>
    </div>
    <Card :aria-busy="pendingBusy">
      <article v-for="file in remotePending" :key="file.id" class="pending-row">
        <button
          v-if="file.preview?.cover_id"
          :aria-label="`预览 ${file.file_name} 的内嵌封面`"
          class="task-thumbnail"
          type="button"
          @click="inspectPending(file)"
        >
          <img :src="fileUrl(file.preview.cover_id)" alt="" loading="lazy" /></button
        ><span v-else class="task-icon">♫</span>
        <div>
          <strong>{{ file.file_name }}</strong>
          <p class="hint">{{ qualities[file.quality] }} · {{ bytes(file.file_size) }}</p>
        </div>
        <Button variant="secondary" size="sm" @click="fromPending(file)">确认归属</Button>
      </article>
      <p v-if="!remotePending.length" class="pending-note hint">
        本页文件已显示在上传队列中，可直接确认归属。
      </p>
    </Card>
    <Pagination
      :busy="pendingBusy"
      :page="pendingPage"
      :page-size="pendingPageSize"
      :total="pendingTotal"
      @change="changePendingPage"
    />
  </section>
</template>
<style scoped>
.task-thumbnail {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 5px;
  overflow: hidden;
  background: var(--surface-muted);
}
.task-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.task-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 30px;
  flex-shrink: 0;
  color: var(--brand);
  background: var(--brand-soft);
  border-radius: 4px;
  font-size: 16px;
}
.task-icon.done {
  background: var(--success-soft);
  color: var(--success);
}
.pending-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}
.pending-row:last-child {
  border: 0;
}
.pending-row > div {
  min-width: 0;
  flex: 1;
}
.pending-row strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.pending-note {
  padding: 14px;
}
@media (max-width: 680px) {
  .task-icon,
  .task-thumbnail {
    grid-column: 1;
    grid-row: 1;
  }
  .task-thumbnail {
    width: 26px;
    height: 30px;
  }
  .pending-row {
    padding: 10px;
    gap: 8px;
  }
}
</style>
