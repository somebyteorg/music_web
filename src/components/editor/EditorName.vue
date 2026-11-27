<script lang="ts" setup>
import { useEditorContext } from './editorContext'

const { editor, props: editorProps } = useEditorContext()
const { form } = editor
</script>

<template>
  <label
    >名称
    <input
      v-model="form.name"
      :placeholder="editorProps.type === 'artists' ? '输入歌手名称' : '输入名称'"
      maxlength="150"
      required
  /></label>
</template>
