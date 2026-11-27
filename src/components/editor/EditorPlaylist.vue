<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import { useEditorContext } from './editorContext'

const { editor } = useEditorContext()
const { form, members, memberQuery, memberOptions, search } = editor
</script>

<template>
  <label class="check-label"><input v-model="form.is_public" type="checkbox" />公开歌单</label>
  <label
    >歌单协作者
    <div class="search-inline">
      <input
        v-model="memberQuery"
        placeholder="搜索成员"
        @keydown.enter.prevent="search('members')"
      /><Button variant="secondary" type="button" @click="search('members')"> 搜索 </Button>
    </div></label
  >
  <div class="chips">
    <button
      v-for="m in members"
      :key="m.id"
      class="chip selected"
      type="button"
      @click="members = members.filter((i) => i.id !== m.id)"
    >
      {{ m.pseudonym || m.username }} ×
    </button>
  </div>
  <div v-if="memberOptions.length" class="picker-results">
    <button
      v-for="m in memberOptions"
      :key="m.id"
      :disabled="members.some((i) => i.id === m.id)"
      type="button"
      @click="
        () => {
          members.push(m)
          memberOptions = []
        }
      "
    >
      ＋ {{ m.pseudonym || m.username }}
    </button>
  </div>
  <p class="hint">私密歌单仅创建者和协作者可见，协作者可以添加、移除歌曲和调整顺序。</p>
</template>
