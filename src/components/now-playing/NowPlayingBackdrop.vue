<script lang="ts" setup>
import { usePlayerMeta } from '@/composables/usePlayerMeta'

/**
 * 沉浸背景：当前曲目封面铺满全屏 + 重度模糊，上面再压一层主题遮罩
 * （两端色是 token：--np-scrim-from / --np-scrim-to，见 tokens-light / tokens-dark）。
 * 没有封面时不渲染 img，退回 brand-soft → bg 的有色底，保证不会变成一片灰白。
 */
const { coverSrc } = usePlayerMeta()
</script>

<template>
  <div aria-hidden="true" class="np-backdrop">
    <img v-if="coverSrc" :src="coverSrc" alt="" class="np-backdrop-img" />
    <div class="np-backdrop-scrim" />
  </div>
</template>

<style scoped>
@layer components {
  .np-backdrop {
    position: fixed;
    z-index: 0;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    /* 无封面兜底：品牌淡紫 → 页面底色，仍然是有色背景 */
    background: linear-gradient(135deg, var(--brand-soft), var(--bg));
  }
  .np-backdrop-img {
    position: fixed;
    inset: -20%;
    width: 140%;
    height: 140%;
    pointer-events: none;
    object-fit: cover;
    filter: blur(90px) saturate(1.7) brightness(0.92);
    transform: scale(1.15);
  }
  .np-backdrop-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, var(--np-scrim-from), var(--np-scrim-to));
  }
}
</style>
