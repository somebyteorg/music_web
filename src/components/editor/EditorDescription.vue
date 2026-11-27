<script lang="ts" setup>
import { useEditorContext } from './editorContext'

const { editor, props: editorProps } = useEditorContext()
const { form } = editor
</script>

<template>
  <label
    >{{ editorProps.type === 'playlists' ? '歌单简介' : '简介'
    }}<textarea
      v-model="form.description"
      maxlength="30000"
      placeholder="输入简介（选填）"
      rows="4"
    ></textarea>
  </label>
</template>
