<script lang="ts" setup>
const taskFilter = defineModel<string>('taskFilter', { required: true })
defineProps<{ filters: { value: string; label: string; count: number }[] }>()
</script>
<template>
  <div aria-label="上传状态" class="queue-filters">
    <button
      v-for="filter in filters"
      :key="filter.value"
      :aria-pressed="taskFilter === filter.value"
      :class="{ active: taskFilter === filter.value }"
      @click="taskFilter = filter.value"
    >
      {{ filter.label }}<span>{{ filter.count }}</span>
    </button>
  </div>
</template>
<style scoped>
.queue-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.queue-filters > button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 9px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-muted);
}
.queue-filters > button.active {
  color: var(--brand-strong);
  background: var(--brand-soft);
  font-weight: 550;
}
.queue-filters > button > span {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
</style>
