<script setup lang="ts">
/**
 * 文字按钮：品牌色、无底色、hover 下划线。替代散落的 class="text-button" 用法。
 *
 * 视觉与全局 .text-button 逐属性一致，并且直接复用这套全局规则（和 Button 复用 .button、
 * Card 复用 .panel 同一口径：组件给 API，基元给视觉）：
 *   padding: 4px 0; color: var(--brand); font-size: 13px; line-height: 1.6;
 *   :hover { text-decoration: underline }
 *   danger 变体叠加 .danger → color: var(--danger)（controls.css 里既有的规则）
 *   disabled → 继承 base.css 的 button:disabled { cursor: not-allowed; opacity: 0.5 }
 * 根元素必须保留 text-button 这个 class：页面会用上下文选择器微调它，例如
 *   .history-list .text-button { white-space: nowrap }（CommunityView）
 *   .cover-editor .text-button { display: block; font-size: 12px }（EditorDialog）
 *   .resource-actions .text-button { white-space: nowrap }（resources.css）
 * 所以样式留在 controls.css 这个单一来源里，不在组件里复制一份。
 *
 * to：路由跳转，语义与 Button 的 to 完全相同（RouterLink custom + 真实 <a href>）。
 */
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    /** default ← .text-button，danger ← .text-button.danger */
    variant?: 'default' | 'danger'
    disabled?: boolean
    /** 路由目标。有值时渲染 <a href> 交给 vue-router，否则渲染 <button type="button"> */
    to?: RouteLocationRaw
  }>(),
  { variant: 'default' },
)

const classes = () => [
  'text-button',
  props.variant === 'danger' && 'danger',
  props.to && props.disabled && 'is-disabled',
]

function navigateTo(event: MouseEvent, navigate: (event?: MouseEvent) => unknown) {
  // 只有 disabled 才拦点击；修饰键/中键保持 RouterLink 的原生语义
  if (props.disabled) {
    event.preventDefault()
    return
  }
  void navigate(event)
}
</script>

<template>
  <RouterLink v-if="to" v-slot="{ href, navigate, isActive, isExactActive }" :to="to" custom>
    <a
      :aria-current="isExactActive ? 'page' : isActive ? 'true' : undefined"
      :aria-disabled="disabled ? 'true' : undefined"
      :class="classes()"
      :href="href"
      :tabindex="disabled ? -1 : undefined"
      @click="navigateTo($event, navigate)"
    >
      <slot />
    </a>
  </RouterLink>
  <button v-else :class="classes()" :disabled="disabled" type="button">
    <slot />
  </button>
</template>

<style scoped>
/* 链接形态没有 :disabled；用与 base.css 中 button:disabled 一致的 0.5 透明度 */
.text-button.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
