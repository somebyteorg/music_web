<script setup lang="ts">
/**
 * 按钮。primary / secondary / sm / ghost / danger 的视觉都在本组件的 <style scoped> 里，
 * 只引用 token，不再依赖全局基元样式。
 *
 * to：路由跳转。内部用 <RouterLink custom> 拿到 href / navigate，仍然渲染真实的 <a href>，
 * 所以右键、中键、新标签页都能用；修饰键（Ctrl/Cmd/Shift/Alt）和 target 语义交给
 * RouterLink 的 navigate 判断（guardEvent 会把带修饰键的点击放行给浏览器），组件只把
 * 点击事件原样转交，不自己拦截。传 to 时忽略 as。
 */
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    /** label 用于「包裹隐藏 file input 的按钮」，页面里 class="button" 的 <label> 都是这个用法 */
    as?: 'button' | 'a' | 'label'
    type?: 'button' | 'submit' | 'reset'
    href?: string
    /** 路由目标。有值时渲染 <a href> 并交给 vue-router 导航，此时 as 被忽略 */
    to?: RouteLocationRaw
    disabled?: boolean
    busy?: boolean
  }>(),
  { as: 'button', size: 'md' },
)

const inactive = () => props.disabled || props.busy

function navigateTo(event: MouseEvent, navigate: (event?: MouseEvent) => unknown) {
  // 只有 disabled / busy 才拦点击；其余（含修饰键、中键）保持 RouterLink 的原生语义
  if (inactive()) {
    event.preventDefault()
    return
  }
  void navigate(event)
}
</script>

<template>
  <RouterLink
    v-if="to"
    v-slot="{ href: routeHref, navigate, isActive, isExactActive }"
    :to="to"
    custom
  >
    <a
      :aria-busy="busy ? 'true' : undefined"
      :aria-current="isExactActive ? 'page' : isActive ? 'true' : undefined"
      :aria-disabled="inactive() ? 'true' : undefined"
      :class="[
        'button',
        variant,
        size === 'sm' && 'small',
        busy && 'is-busy',
        inactive() && 'is-inactive',
      ]"
      :href="routeHref"
      :tabindex="inactive() ? -1 : undefined"
      @click="navigateTo($event, navigate)"
    >
      <slot name="icon" />
      <slot />
    </a>
  </RouterLink>
  <component
    :is="as"
    v-else
    :aria-busy="busy ? 'true' : undefined"
    :aria-disabled="as === 'a' && inactive() ? 'true' : undefined"
    :class="['button', variant, size === 'sm' && 'small', busy && 'is-busy']"
    :disabled="as === 'button' ? inactive() : undefined"
    :href="as === 'a' ? href : undefined"
    :type="as === 'button' ? type : undefined"
  >
    <slot name="icon" />
    <slot />
  </component>
</template>

<style scoped>
@layer components {
  .button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 9px 16px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-size: 13px;
    font-weight: 550;
    line-height: 1.5;
    white-space: nowrap;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .button.primary {
    background: var(--brand);
    color: var(--on-brand);
  }

  .button.primary:hover:not(:disabled) {
    background: var(--brand-strong);
    box-shadow: var(--shadow-brand);
  }

  .button.secondary {
    background: var(--surface);
    border-color: var(--line);
  }

  .button.secondary:hover:not(:disabled) {
    background: var(--surface-muted);
    border-color: var(--line-strong);
  }

  .button.small {
    min-height: 34px;
    padding: 6px 12px;
    font-size: 12px;
  }

  @media (max-width: 680px) {
    .button {
      padding-inline: 10px;
    }
  }

  @media (pointer: coarse) {
    .button {
      min-height: 38px;
    }
  }

  .button.ghost {
    color: var(--text-soft);
  }

  .button.ghost:hover:not(:disabled) {
    background: var(--surface-muted);
    color: var(--brand-strong);
  }

  .button.danger {
    color: var(--danger);
  }

  .button.danger:hover:not(:disabled) {
    background: var(--danger-soft);
    color: var(--danger-ink);
  }

  .button.is-busy {
    opacity: 0.6;
  }

  /* 链接形态没有 :disabled，disabled/busy 时用同一份视觉（与 .is-busy 的 0.6 对齐） */
  .button.is-inactive {
    cursor: not-allowed;
    opacity: 0.6;
  }
}
</style>
