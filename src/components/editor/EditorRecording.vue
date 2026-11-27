<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { useEditorContext } from './editorContext'

const { editor } = useEditorContext()
const { form, recordingQuery, recordingOptions, recordingSongId, searchRecordings } = editor
</script>

<template>
  <label
    >录音版本<input
      v-model="form.recording_version"
      maxlength="100"
      placeholder="现场、翻唱、混音、重制等，请标明版本"
  /></label>
  <label
    >关联的录音版本（可选）
    <div class="search-inline">
      <input
        v-model="recordingQuery"
        placeholder="可选，确认同一录音后再关联"
        @input="recordingSongId = ''"
        @keydown.enter.prevent="searchRecordings"
      /><Button variant="secondary" type="button" @click="searchRecordings"> 查找 </Button>
    </div></label
  >
  <div v-if="recordingOptions.length" class="picker-results">
    <button
      v-for="song in recordingOptions"
      :key="song.id"
      type="button"
      @click="
        () => {
          recordingSongId = song.id
          recordingQuery = song.name
          recordingOptions = []
        }
      "
    >
      {{ song.name
      }}<small
        >{{ song.artists?.map((a) => a.name).join(' / ') }} ·
        {{ song.albums?.map((album) => album.name).join(' / ') || '单曲' }} ·
        {{ song.recording_version || '未标注版本' }}</small
      >
    </button>
  </div>
  <p v-if="recordingSongId" class="hint">
    关联录音：{{ recordingQuery }}。专辑归属、音频与歌词分别保留。<TextButton
      @click="recordingSongId = ''"
    >
      取消本次关联
    </TextButton>
  </p>
</template>
