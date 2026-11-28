<script generic="T extends string | number" lang="ts" setup>
import { computed, nextTick, ref, useId, watch } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'

const model = defineModel<T>({ required: true })
const props = withDefaults(
  defineProps<{
    options: readonly { value: T; label: string }[]
    label: string
    disabled?: boolean
    searchable?: boolean
  }>(),
  { searchable: true },
)
const id = useId(),
  root = ref<HTMLElement>(),
  trigger = ref<HTMLButtonElement>(),
  dropdown = ref<HTMLElement>(),
  searchInput = ref<HTMLInputElement>(),
  open = ref(false),
  query = ref(''),
  active = ref(-1),
  position = ref({ top: '0px', left: '0px', width: '200px', maxHeight: '320px' })
const selected = computed(() => props.options.find((option) => option.value === model.value))
const filtered = computed(() => {
  const value = query.value.trim().toLocaleLowerCase()
  return props.options.filter((option) => option.label.toLocaleLowerCase().includes(value))
})
function locate() {
  if (!open.value || !trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const below = window.innerHeight - rect.bottom - 12
  const above = rect.top - 12
  const height = Math.min(320, Math.max(below, above))
  const width = Math.min(Math.max(rect.width, 200), window.innerWidth - 24)
  position.value = {
    top:
      below >= Math.min(240, height)
        ? `${rect.bottom + 4}px`
        : `${Math.max(8, rect.top - Math.min(height, dropdown.value?.offsetHeight || height) - 4)}px`,
    left: `${Math.min(Math.max(12, rect.left), window.innerWidth - width - 12)}px`,
    width: `${width}px`,
    maxHeight: `${height}px`,
  }
}
async function show() {
  if (props.disabled) return
  query.value = ''
  active.value = Math.max(
    0,
    props.options.findIndex((option) => option.value === model.value),
  )
  open.value = true
  locate()
  await nextTick()
  locate()
  if (props.searchable) searchInput.value?.focus()
  else trigger.value?.focus()
  reveal()
}
function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) trigger.value?.focus()
}
function choose(value: T) {
  model.value = value
  close(true)
}
function reveal() {
  dropdown.value
    ?.querySelector(`#${CSS.escape(id)}-option-${active.value}`)
    ?.scrollIntoView({ block: 'nearest' })
}
function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close(true)
  } else if (event.key === 'Tab') close(true)
  else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) {
      void show()
      return
    }
    active.value = Math.max(
      0,
      Math.min(filtered.value.length - 1, active.value + (event.key === 'ArrowDown' ? 1 : -1)),
    )
    void nextTick(reveal)
  } else if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    const option = filtered.value[active.value]
    if (option) choose(option.value)
  }
}
watch(query, () => {
  active.value = filtered.value.length ? 0 : -1
  void nextTick(locate)
})
watch(
  () => props.disabled,
  (value) => {
    if (value) close()
  },
)
onClickOutside(dropdown, () => close(), { ignore: [root] })
useEventListener(window, 'resize', locate)
useEventListener(window, 'scroll', locate, { capture: true, passive: true })
</script>

<template>
  <div ref="root" class="select-control">
    <button
      ref="trigger"
      :aria-activedescendant="
        open && !searchable && active >= 0 ? `${id}-option-${active}` : undefined
      "
      :aria-controls="`${id}-list`"
      :aria-expanded="open"
      :aria-label="`${label}：${selected?.label || '请选择'}`"
      :disabled="disabled"
      aria-haspopup="listbox"
      class="select-trigger"
      role="combobox"
      type="button"
      @click="open ? close() : show()"
      @keydown="keydown"
    >
      <span>{{ selected?.label || '请选择' }}</span><svg
        aria-hidden="true"
        height="14"
        viewBox="0 0 16 16"
        width="14"
      >
        <path
          d="m4 6 4 4 4-4"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
        />
      </svg>
    </button>
    <Teleport :to="root?.closest('dialog') || 'body'">
      <div v-if="open" ref="dropdown" :style="position" class="select-dropdown" tabindex="-1">
        <div v-if="searchable" class="select-search">
          <input
            ref="searchInput"
            v-model="query"
            :aria-activedescendant="active >= 0 ? `${id}-option-${active}` : undefined"
            :aria-controls="`${id}-list`"
            :aria-label="`搜索${label}选项`"
            aria-autocomplete="list"
            aria-expanded="true"
            autocomplete="off"
            placeholder="搜索选项…"
            role="combobox"
            @keydown="keydown"
          />
        </div>
        <div :id="`${id}-list`" :aria-label="label" class="select-options" role="listbox">
          <button
            v-for="(option, index) in filtered"
            :id="`${id}-option-${index}`"
            :key="option.value"
            :aria-selected="option.value === model"
            :class="{ selected: option.value === model, active: index === active }"
            role="option"
            tabindex="-1"
            type="button"
            @click="choose(option.value)"
            @pointermove="active = index"
          >
            <span>{{ option.label }}</span><span v-if="option.value === model" aria-hidden="true"
              >✓</span
            >
          </button>
          <p v-if="!filtered.length" class="select-blank">没有匹配的选项</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@layer components {
  .select-control {
    display: inline-flex;
    min-width: 0;
  }
  .select-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 40px;
    padding: 9px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--text-soft);
    text-align: left;
    font-size: 13px;
    white-space: nowrap;
  }
  .select-trigger:hover:not(:disabled) {
    border-color: var(--brand-line-strong);
  }
  .select-trigger[aria-expanded='true'] {
    border-color: var(--brand);
    box-shadow: var(--shadow-select-focus);
  }
  .select-trigger > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .select-trigger svg {
    flex-shrink: 0;
    color: var(--text-muted);
  }
  .select-dropdown {
    position: fixed;
    z-index: 150;
    display: flex;
    flex-direction: column;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    box-shadow: var(--shadow-select);
    overflow: hidden;
    outline: none;
  }
  .select-search {
    padding: 3px 3px 7px;
    flex-shrink: 0;
  }
  .select-search input {
    min-height: 32px;
    background: var(--surface-muted);
    font-size: 13px;
  }
  .select-options {
    overflow-y: auto;
    min-height: 0;
    overscroll-behavior: contain;
  }
  .select-options > button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 4px;
    color: var(--text-soft);
    text-align: left;
    font-size: 13px;
  }
  .select-options > button.active {
    background: var(--surface-muted);
  }
  .select-options > button.selected {
    color: var(--brand-strong);
    font-weight: 550;
    background: var(--brand-soft);
  }
  .select-blank {
    padding: 18px 10px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }
  @media (pointer: coarse) {
    .select-trigger,
    .select-options > button {
      min-height: 40px;
    }
  }
}
</style>
