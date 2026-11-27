<script lang="ts" setup>
import BaseSelect from '@/components/BaseSelect.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { useEditorContext } from './editorContext'

const { editor, props: editorProps } = useEditorContext()
const {
  albumQuery,
  albumOptions,
  assignmentChosen,
  albumSelectionName,
  assignmentReason,
  libraries,
  busy,
  form,
  trackRows,
  search,
  pickAlbum,
  numberTracks,
} = editor
</script>

<template>
  <template v-if="editorProps.libraryMode">
    <p class="hint">
      为所选 {{ editorProps.tracks?.length || 0 }} 首歌曲修改媒体库，专辑关联与音频资源会保留。
    </p>
    <label
      >目标媒体库<BaseSelect
        v-model="form.library_id"
        :disabled="libraries.busy || busy"
        :options="libraries.options"
        label="目标媒体库"
    /></label>
    <p v-if="libraries.error" class="error-text">
      {{ libraries.error }}
      <TextButton @click="libraries.load(true)">重试</TextButton>
    </p>
    <label>修改原因<textarea v-model="assignmentReason" maxlength="1000" rows="2" /></label>
  </template>
  <template v-else>
    <p class="hint">
      本次整理
      {{ trackRows.length }}
      首曲目。只调整目标专辑的收录和曲序，其他专辑关联、音频与歌词会保留。
    </p>
    <label
      >目标专辑
      <div class="search-inline">
        <input
          v-model="albumQuery"
          placeholder="输入专辑名称搜索"
          @keydown.enter.prevent="search('albums')"
        /><Button variant="secondary" type="button" @click="search('albums')">搜索</Button>
      </div></label
    >
    <div v-if="albumOptions.length" class="picker-results">
      <button
        v-for="album in albumOptions"
        :key="album.id"
        type="button"
        @click="
          () => {
            pickAlbum(album)
          }
        "
      >
        <strong>{{ album.name }}</strong><small
          >{{ album.artists?.map((a) => a.name).join(' / ') || '未填写专辑艺人' }} ·
          {{ album.release_year || album.release_date?.slice(0, 4) || '年份未知' }}
          {{ album.edition }} {{ album.catalog_number }}</small
        >
      </button>
    </div>
    <p v-if="assignmentChosen" class="notice">
      {{ form.album_id ? `归入：${albumSelectionName}` : '作为单曲，暂不归入专辑' }}
    </p>
    <TextButton @click="numberTracks"> 按当前顺序从 1 编号（每张碟分别编号） </TextButton>
    <div class="album-track-rows">
      <article v-for="row in trackRows" :key="row.song.id" :class="{ removed: row.remove }">
        <div>
          <strong>{{ row.song.name }}</strong>
          <p class="hint">
            {{ row.song.albums?.map((album) => album.name).join(' / ') || '单曲' }}
          </p>
        </div>
        <label
          >碟号<input
            v-model.number="row.disc_number"
            :disabled="row.remove"
            max="999"
            min="1"
            required
            type="number" /></label
        ><label
          >曲序<input
            v-model.number="row.track_number"
            :disabled="row.remove"
            max="9999"
            min="1"
            required
            type="number" /></label
        ><label class="check-label"><input v-model="row.remove" type="checkbox" />移出</label>
      </article>
    </div>
    <label
      >修改原因<textarea
        v-model="assignmentReason"
        maxlength="1000"
        placeholder="选填，说明修改原因"
        rows="2"
      />
    </label>
  </template>
</template>

<style scoped src="./trackRows.css"></style>
