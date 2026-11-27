<script setup lang="ts">
import { computed } from 'vue'

/**
 * 胶囊按钮：替代原来的全局 .chip / .chip.selected 页面类。
 *
 * 根元素仍保留 chip 这个 class（外部上下文选择器可以继续按它定位），选中态仍是
 * .chip.selected；两份 class 都在下面这个 computed 里拼，模板不写字面量——
 * 页面只写 <Chip :selected="…">，全站 .vue 里不再出现手写的 chip class。
 *
 * 样式原来是 styles/controls.css 的 .chip 三条规则，逐属性搬进本组件的 scoped 样式：
 * .chip.selected 与 .chip:hover 的特异性同为 (0,3,0)，仍是后者覆盖前者的描边色。
 */
const props = withDefaults(defineProps<{ selected?: boolean }>(), { selected: false })
const classes = computed(() => ({ chip: true, selected: props.selected }))
</script>

<template>
  <button :class="classes" type="button">
    <slot />
  </button>
</template>

<style scoped>
.chip {
  padding: 8px 13px;
  min-height: 40px;
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.chip.selected {
  background: var(--brand-soft);
  color: var(--brand-strong);
  border-color: var(--brand-line);
}

.chip:hover {
  border-color: var(--brand-line-hover);
}

/* 触屏尺寸：原在 responsive.css 的 (pointer: coarse) 块里，组件化后放在这里，
 * 才不会被 .chip[data-v] 更高的特异性反压回 40px。 */
@media (pointer: coarse) {
  .chip {
    min-height: 38px;
  }
}
</style>
