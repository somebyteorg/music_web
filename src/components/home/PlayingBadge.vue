<script lang="ts" setup>
/**
 * 「正在播放」徽标：品牌色圆点 + 三条 2px 竖条（均衡器）。
 * 纯装饰（aria-hidden）：状态由所在卡片的 aria-current / aria-label 表达。
 * reduce 下不跳动，三条竖条停在静态高度。
 */
</script>

<template>
  <span aria-hidden="true" class="playing-badge"><i></i><i></i><i></i></span>
</template>

<style scoped>
@layer components {
  .playing-badge {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 2px;
    width: 18px;
    height: 18px;
    padding: 4px 3px;
    border-radius: 50%;
    background: var(--brand);
  }
  .playing-badge i {
    width: 2px;
    height: 100%;
    border-radius: 1px;
    background: var(--on-brand);
    transform-origin: bottom;
    animation: playing-bar 0.9s ease-in-out infinite;
  }
  .playing-badge i:nth-child(2) {
    animation-delay: 0.15s;
  }
  .playing-badge i:nth-child(3) {
    animation-delay: 0.3s;
  }
  @keyframes playing-bar {
    0%,
    100% {
      transform: scaleY(0.35);
    }
    50% {
      transform: scaleY(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .playing-badge i {
      animation: none;
      transform: scaleY(0.7);
    }
  }
}
</style>
