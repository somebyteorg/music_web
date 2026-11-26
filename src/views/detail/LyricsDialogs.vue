<script lang="ts" setup>
import { inject, ref } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'
import { useSignStore } from '@/stores/sign'
import { lyricFormats, lyricKinds } from '@/features/catalog/useSongLyrics'
import type { CatalogType } from '@/types/catalog'
import { songLyricsKey } from './lyricsContext'

defineProps<{ type: CatalogType }>()

const lyrics = inject(songLyricsKey)
if (!lyrics) throw new Error('歌词弹窗缺少上下文（songLyricsKey）')
const sign = useSignStore()
const lyricInput = ref<HTMLInputElement>()
</script>

<template>
  <BaseDialog
    v-if="type === 'songs'"
    v-model="lyrics.editor"
    :busy="lyrics.busy"
    :title="lyrics.editingId ? '编辑歌词版本' : '添加歌词版本'"
    wide
  >
    <form id="song-lyrics-form" class="form-stack" @submit.prevent="lyrics.save">
      <div class="form-grid">
        <label
          >版本名称<input
            v-model="lyrics.form.name"
            maxlength="100"
            placeholder="如：官方原文、简体翻译、现场逐字版"
            required
        /></label>
        <label
          >语言<input
            v-model="lyrics.form.language"
            maxlength="35"
            placeholder="zh-Hans、en、und"
            required
        /></label>
        <label
          >格式<BaseSelect
            v-model="lyrics.form.format"
            :options="lyricFormats"
            :searchable="false"
            label="歌词格式"
        /></label>
        <label
          >用途<BaseSelect
            v-model="lyrics.form.kind"
            :options="lyricKinds"
            :searchable="false"
            label="歌词用途"
        /></label>
      </div>
      <label
        >来源<input
          v-model="lyrics.form.source"
          maxlength="500"
          placeholder="提供者、来源网站或文件名（选填）"
      /></label>
      <div class="button-group">
        <input
          ref="lyricInput"
          accept=".txt,.lrc,.elrc,.ttml"
          hidden
          type="file"
          @change="lyrics.importFile"
        />
        <button
          :disabled="lyrics.busy"
          class="button secondary"
          type="button"
          @click="lyricInput?.click()"
        >
          从文件导入
        </button>
        <span class="hint">UTF-8 编码，保留原始歌词和时间标签。</span>
      </div>
      <label
        >歌词内容<textarea
          v-model="lyrics.form.content"
          maxlength="100000"
          required
          rows="16"
          spellcheck="false"
        ></textarea>
      </label>
      <label class="check-label"
        ><input v-model="lyrics.form.is_default" type="checkbox" />设为默认歌词版本</label
      >
    </form>
    <template #footer
      ><button :disabled="lyrics.busy" class="button secondary" @click="lyrics.editor = false">
        取消</button
      ><button :disabled="lyrics.busy" class="button primary" form="song-lyrics-form">
        {{ lyrics.busy ? '正在保存…' : '保存版本' }}
      </button></template
    >
  </BaseDialog>
  <BaseDialog
    v-if="type === 'songs'"
    v-model="lyrics.removing"
    :busy="lyrics.busy"
    title="删除歌词版本"
  >
    <div class="form-stack">
      <p class="hint">会保留操作记录，可从记录中恢复。</p>
      <label
        >删除原因<textarea
          v-model="lyrics.reason"
          :required="lyrics.selected?.user_id !== sign.user?.id"
          maxlength="1000"
          rows="3"
        ></textarea>
      </label>
    </div>
    <template #footer
      ><button :disabled="lyrics.busy" class="button secondary" @click="lyrics.removing = false">
        取消</button
      ><button
        :disabled="
          lyrics.busy || (lyrics.selected?.user_id !== sign.user?.id && !lyrics.reason.trim())
        "
        class="button primary"
        @click="lyrics.destroy"
      >
        确认删除
      </button></template
    >
  </BaseDialog>
</template>

<style scoped src="./lyrics.css"></style>
