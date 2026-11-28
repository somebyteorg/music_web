<script lang="ts" setup>
import BaseSelect from '@/components/BaseSelect.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { useEditorContext } from './editorContext'

const { editor } = useEditorContext()
const { form, libraries, busy, albumEntries, albumOptions, albumQuery, search, pickAlbum } = editor
</script>

<template>
  <span class="field-label"
    >所属媒体库<BaseSelect
      v-model="form.library_id"
      :disabled="libraries.busy || busy"
      :options="libraries.options"
      label="歌曲所属媒体库"
  /></span>
  <p v-if="libraries.error" class="error-text">
    {{ libraries.error }}
    <TextButton @click="libraries.reload()">重试</TextButton>
  </p>
  <label
    >收录专辑（可添加多张）
    <div class="search-inline">
      <input
        v-model="albumQuery"
        placeholder="搜索并添加专辑"
        @keydown.enter.prevent="search('albums')"
      /><Button variant="secondary" type="button" @click="search('albums')"> 搜索 </Button>
    </div></label
  >
  <div v-if="albumOptions.length" class="picker-results">
    <button
      v-for="album in albumOptions"
      :key="album.id"
      :disabled="albumEntries.some((entry) => entry.album.id === album.id)"
      type="button"
      @click="pickAlbum(album)"
    >
      <strong>{{ album.name }}</strong><small
        >{{ album.artists?.map((artist) => artist.name).join(' / ') }} ·
        {{ album.release_year || album.release_date?.slice(0, 4) || '年份未知' }}
        {{ album.edition }} {{ album.catalog_number }}</small
      >
    </button>
  </div>
  <div class="album-track-rows">
    <article v-for="entry in albumEntries" :key="entry.album.id">
      <div>
        <strong>{{ entry.album.name }}</strong>
        <p class="hint">{{ entry.album.release_year || '' }} {{ entry.album.edition || '' }}</p>
      </div>
      <label
        >碟号<input
          v-model.number="entry.disc_number"
          max="999"
          min="1"
          required
          type="number" /></label
      ><label
        >曲序<input
          v-model.number="entry.track_number"
          max="9999"
          min="1"
          required
          type="number" /></label
      ><TextButton
        variant="danger"
        @click="albumEntries = albumEntries.filter((row) => row !== entry)"
      >
        移出
      </TextButton>
    </article>
  </div>
  <p class="hint">
    每张专辑分别保存碟号与曲序。移出一张专辑会保留歌曲及其余收录，未关联专辑时作为单曲。
  </p>
</template>

<style scoped src="./trackRows.css"></style>
