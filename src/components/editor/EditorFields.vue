<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import Chip from '@/components/ui/Chip.vue'
import Field from '@/components/ui/Field.vue'
import { useEditorContext } from './editorContext'

const { editor, props: editorProps } = useEditorContext()
const { form, artists, options, query, search } = editor
</script>

<template>
  <template v-if="['songs', 'albums'].includes(editorProps.type)">
    <Field v-slot="{ id }" :label="editorProps.type === 'albums' ? '专辑艺人' : '歌曲演唱者'">
      <div class="search-inline">
        <input
          :id="id"
          v-model="query"
          placeholder="搜索歌手"
          @keydown.enter.prevent="search('artists')"
        /><Button variant="secondary" type="button" @click="search('artists')"> 搜索 </Button>
      </div>
    </Field>
    <div class="chips">
      <Chip
        v-for="a in artists"
        :key="a.id"
        selected
        @click="artists = artists.filter((i) => i.id !== a.id)"
      >
        {{ a.name }} ×
      </Chip>
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
      <Field v-slot="{ id }" label="发行日期"
        ><input :id="id" v-model="form.release_date" type="date"
      /></Field>
      <Field v-slot="{ id }" label="风格"
        ><input :id="id" v-model="form.genre" maxlength="100" placeholder="比如：流行、爵士"
      /></Field>
    </div>
  </template>
  <div v-if="editorProps.type === 'albums'" class="form-grid">
    <Field v-slot="{ id }" label="发行年份"
      ><input
        :id="id"
        v-model.number="form.release_year"
        max="9999"
        min="1000"
        placeholder="仅知道年份时填写"
        type="number"
    /></Field>
    <Field v-slot="{ id }" label="发行版本"
      ><input :id="id" v-model="form.edition" maxlength="100" placeholder="首版、重制版等"
    /></Field>
    <Field v-slot="{ id }" label="发行地区"
      ><input :id="id" v-model="form.release_country" maxlength="100"
    /></Field>
    <Field v-slot="{ id }" label="唱片编号"
      ><input :id="id" v-model="form.catalog_number" maxlength="100"
    /></Field>
    <Field v-slot="{ id }" label="厂牌"
      ><input :id="id" v-model="form.label" maxlength="255"
    /></Field>
    <Field v-slot="{ id }" label="MusicBrainz 发行 ID"
      ><input :id="id" v-model="form.musicbrainz_id" maxlength="36"
    /></Field>
    <Field v-slot="{ id }" label="碟片总数"
      ><input :id="id" v-model.number="form.total_discs" max="999" min="1" type="number"
    /></Field>
    <Field v-slot="{ id }" label="曲目总数"
      ><input :id="id" v-model.number="form.total_tracks" max="9999" min="1" type="number"
    /></Field>
  </div>
</template>
