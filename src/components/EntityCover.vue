<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { Person } from '@/types/catalog'
import { fileUrl } from '@/utils/file'

const props = defineProps<{ item?: Person; round?: boolean; source?: string | null }>()
/** 容器用 CSS 定尺寸（aspect-ratio: 1）；宽高属性只提供 1:1 的固有比例，解码前不撑开布局 */
const COVER_EDGE = 96
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
    <img
      v-if="src && !failed"
      :src="src"
      alt=""
      loading="lazy"
      decoding="async"
      fetchpriority="low"
      :width="COVER_EDGE"
      :height="COVER_EDGE"
      @error="failed = true"
    /><template v-else
      ><span class="cover-ring"></span><span class="cover-note">{{ round ? '♫' : '♪' }}</span
      ><span class="cover-caption">{{ item?.name?.slice(0, 9) || '跃律' }}</span></template
    >
  </div>
</template>

<style scoped>
@layer components {
  .cover {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    min-width: 0;
    overflow: hidden;
    border-radius: var(--radius-cover);
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
    background: linear-gradient(145deg, var(--cover-0-tint), var(--cover-0));
    color: var(--cover-0-ink);
  }
  .color-1 {
    background: linear-gradient(145deg, var(--cover-1-tint), var(--cover-1));
    color: var(--cover-1-ink);
  }
  .color-2 {
    background: linear-gradient(145deg, var(--cover-2-tint), var(--cover-2));
    color: var(--cover-2-ink);
  }
  .color-3 {
    background: linear-gradient(145deg, var(--cover-3-tint), var(--cover-3));
    color: var(--cover-3-ink);
  }
  .color-4 {
    background: linear-gradient(145deg, var(--cover-4-tint), var(--cover-4));
    color: var(--cover-4-ink);
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
    box-shadow: 0 0 0 8cqw var(--ring-highlight);
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
}
</style>
