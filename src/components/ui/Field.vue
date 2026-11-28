<script setup lang="ts">
import { useId } from 'vue'

/**
 * 表单字段：<label for> + 控件插槽。
 * 插槽内容要拿 id 才能建立编程关联——用作用域插槽：
 *   <Field label="发行日期" v-slot="{ id }"><input :id="id" … /></Field>
 * 提示/错误由使用方在字段外自行表达（见 .hint / .notice）。
 */
defineProps<{ label?: string }>()

const id = useId()
</script>

<template>
  <label class="ui-field" :for="id">
    <span v-if="label">{{ label }}</span>
    <slot :id="id" />
  </label>
</template>
