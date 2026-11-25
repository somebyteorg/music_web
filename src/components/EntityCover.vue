<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { Person } from '@/types/catalog'
import { fileUrl } from '@/utils/file'

const props = defineProps<{ item?: Person; round?: boolean; source?: string | null }>()
const failed = ref(false)
const src = computed(() =>
  props.source !== undefined
    ? props.source || undefined
    : props.item?.cover_id
      ? fileUrl(props.item.cover_id)
      : props.item?.image_url || undefined,
)
const hue = computed(
  () => [...(props.item?.name || '跃律')].reduce((n, c) => n + c.charCodeAt(0), 0) % 5,
)
watch(src, () => (failed.value = false))
</script>
<template>
  <div :class="['cover', `color-${hue}`, { round }]" aria-hidden="true">
    <img v-if="src && !failed" :src="src" alt="" loading="lazy" @error="failed = true" /><template
      v-else
      ><span class="cover-ring"></span><span class="cover-note">{{ round ? '♫' : '♪' }}</span
      ><span class="cover-caption">{{ item?.name?.slice(0, 9) || '跃律' }}</span></template
    >
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  min-width: 0;
  overflow: hidden;
  border-radius: var(--radius-md);
  isolation: isolate;
  container-type: inline-size;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cover.round {
  border-radius: 50%;
}
.color-0 {
  background: linear-gradient(145deg, #d5c9e6, #a892c1);
  color: #69517f;
}
.color-1 {
  background: linear-gradient(145deg, #e2dfc9, #b8b18d);
  color: #726c47;
}
.color-2 {
  background: linear-gradient(145deg, #edd8c9, #c59c89);
  color: #91604c;
}
.color-3 {
  background: linear-gradient(145deg, #d6e4db, #99b8ab);
  color: #4b7967;
}
.color-4 {
  background: linear-gradient(145deg, #d1dbea, #95a9ca);
  color: #526d97;
}
.cover-ring {
  position: absolute;
  right: -23%;
  top: -4%;
  width: 100%;
  height: 100%;
  border: 1px solid currentColor;
  border-radius: 50%;
  opacity: 0.35;
}
.cover-ring::after {
  content: '';
  position: absolute;
  inset: 12%;
  border: 1px solid currentColor;
  border-radius: 50%;
  box-shadow: 0 0 0 8cqw #ffffff0a;
}
.cover-note {
  position: absolute;
  top: 7%;
  left: 14%;
  font-family: Georgia, serif;
  font-size: 35cqw;
  font-style: italic;
  opacity: 0.55;
  transform: rotate(-14deg);
}
.cover-caption {
  position: absolute;
  bottom: 13%;
  left: 14%;
  font-size: 7cqw;
  letter-spacing: 0.06em;
  opacity: 0.7;
  font-weight: 550;
}
</style>
