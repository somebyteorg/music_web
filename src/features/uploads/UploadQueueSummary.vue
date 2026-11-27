<script lang="ts" setup>
import Card from '@/components/ui/Card.vue'
import { useUploadsStore } from '@/stores/uploads'
import { bytes, duration } from '@/utils/format'

const uploads = useUploadsStore()
</script>
<template>
  <Card v-if="uploads.tasks.length" aria-label="队列整体进度" class="queue-summary">
    <div class="summary-heading">
      <div>
        <span class="hint">文件传输</span
        ><strong>{{ uploads.stats.progress }}<small>%</small></strong
        ><span class="hint"
          >{{ bytes(uploads.stats.sent) }} / {{ bytes(uploads.stats.total) }}</span
        >
      </div>
      <div class="summary-speed">
        <strong>{{
          !uploads.stats.total
            ? '无需重复传输'
            : uploads.stats.speed
              ? `${bytes(uploads.stats.speed)}/s`
              : uploads.stats.uploading
                ? '正在上传'
                : uploads.stats.preparing
                  ? '正在校验文件'
                  : uploads.stats.sent >= uploads.stats.total
                    ? '传输已完成'
                    : '等待传输'
        }}</strong><span class="hint">{{
          uploads.stats.sent >= uploads.stats.total
            ? '解析、确认与入库状态见下方'
            : uploads.stats.remaining !== null
              ? `预计还需 ${duration(uploads.stats.remaining)}`
              : '剩余时间待估算'
        }}</span>
      </div>
    </div>
    <div
      :aria-valuenow="uploads.stats.progress"
      aria-label="整体文件传输进度"
      aria-valuemax="100"
      aria-valuemin="0"
      class="summary-progress"
      role="progressbar"
    >
      <span :style="{ width: `${uploads.stats.progress}%` }"></span>
    </div>
    <div class="summary-stages">
      <span :class="{ current: uploads.stats.preparing }"
        >校验 <b>{{ uploads.stats.preparing }}</b></span
      >
      <span :class="{ current: uploads.stats.transmitting }"
        >上传 <b>{{ uploads.stats.transmitting }}</b></span
      >
      <span :class="{ current: uploads.stats.processing }"
        >解析 <b>{{ uploads.stats.processing }}</b></span
      >
      <span :class="{ current: uploads.stats.ready }"
        >待确认 <b>{{ uploads.stats.ready }}</b></span
      >
      <span :class="{ current: uploads.stats.publishing }"
        >入库 <b>{{ uploads.stats.publishing }}</b></span
      >
      <span
        >已完成 <b>{{ uploads.stats.done }}</b></span
      >
    </div>
  </Card>
</template>
<style scoped>
.queue-summary {
  padding: 18px 20px;
  margin-bottom: 18px;
}
.summary-heading,
.summary-heading > div:first-child {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.summary-heading {
  justify-content: space-between;
}
.summary-heading > div:first-child > strong {
  color: var(--brand-strong);
  font-size: 28px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.summary-heading small {
  margin-left: 2px;
  font-size: 13px;
  font-weight: 500;
}
.summary-speed {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.summary-progress {
  height: 6px;
  margin: 15px 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--brand-soft);
}
.summary-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--brand);
  transition: width 0.2s;
}
.summary-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  color: var(--text-muted);
  font-size: 12px;
}
.summary-stages b {
  margin-left: 4px;
  font-weight: 550;
  font-variant-numeric: tabular-nums;
}
.summary-stages .current {
  color: var(--brand-strong);
}
@media (max-width: 680px) {
  .queue-summary {
    padding: 15px;
  }
  .summary-heading {
    align-items: center;
  }
  .summary-heading > div:first-child {
    gap: 6px 10px;
  }
  .summary-heading > div:first-child > .hint:last-child {
    flex-basis: 100%;
  }
  .summary-speed {
    font-size: 12px;
  }
  .summary-stages {
    gap: 8px 16px;
  }
}
</style>
