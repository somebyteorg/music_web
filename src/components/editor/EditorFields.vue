<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import Field from '@/components/ui/Field.vue'
import { useEditorContext } from './editorContext'

const { editor, props: editorProps } = useEditorContext()
const { form, artists, options, query, search } = editor
</script>

<template>
  <template v-if="['songs', 'albums'].includes(editorProps.type)">
    <Field :label="editorProps.type === 'albums' ? '专辑艺人' : '歌曲演唱者'">
      <div class="search-inline">
        <input
          v-model="query"
          placeholder="搜索歌手"
          @keydown.enter.prevent="search('artists')"
        /><Button variant="secondary" type="button" @click="search('artists')"> 搜索 </Button>
      </div>
    </Field>
    <div class="chips">
      <button
        v-for="a in artists"
        :key="a.id"
        class="chip selected"
        type="button"
        @click="artists = artists.filter((i) => i.id !== a.id)"
      >
        {{ a.name }} ×
      </button>
    </div>
    <div v-if="options.length" class="picker-results">
      <button
        v-for="a in options"
        :key="a.id"
        :disabled="artists.some((i) => i.id === a.id)"
        type="button"
        @click="
          () => {
            artists.push(a)
            options = []
            query = ''
          }
        "
      >
        ＋ {{ a.name }}
      </button>
    </div>
    <p class="hint">没有找到歌手时，可以先到歌手页面新建。</p>
    <div class="form-grid">
      <Field label="发行日期"><input v-model="form.release_date" type="date" /></Field>
      <Field label="风格"
        ><input v-model="form.genre" maxlength="100" placeholder="比如：流行、爵士"
      /></Field>
    </div>
  </template>
  <div v-if="editorProps.type === 'albums'" class="form-grid">
    <Field label="发行年份"
      ><input
        v-model.number="form.release_year"
        max="9999"
        min="1000"
        placeholder="仅知道年份时填写"
        type="number"
    /></Field>
    <Field label="发行版本"
      ><input v-model="form.edition" maxlength="100" placeholder="首版、重制版等"
    /></Field>
    <Field label="发行地区"><input v-model="form.release_country" maxlength="100" /></Field>
    <Field label="唱片编号"><input v-model="form.catalog_number" maxlength="100" /></Field>
    <Field label="厂牌"><input v-model="form.label" maxlength="255" /></Field>
    <Field label="MusicBrainz 发行 ID"
      ><input v-model="form.musicbrainz_id" maxlength="36"
    /></Field>
    <Field label="碟片总数"
      ><input v-model.number="form.total_discs" max="999" min="1" type="number"
    /></Field>
    <Field label="曲目总数"
      ><input v-model.number="form.total_tracks" max="9999" min="1" type="number"
    /></Field>
  </div>
</template>
