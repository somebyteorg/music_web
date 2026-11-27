<script lang="ts" setup>
import Card from '@/components/ui/Card.vue'
import Tabs from '@/components/ui/Tabs.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import { inject } from 'vue'
import BaseSelect from '@/components/BaseSelect.vue'
import { useSignStore } from '@/stores/sign'
import { date } from '@/utils/format'
import { lyricKinds } from '@/features/catalog/useSongLyrics'
import { songLyricsKey } from './lyricsContext'

const lyrics = inject(songLyricsKey)
if (!lyrics) throw new Error('歌词面板缺少上下文（songLyricsKey）')
const sign = useSignStore()
</script>

<template>
  <Card as="section" class="lyrics-panel">
    <div class="section-heading">
      <h2>
        歌词 <span class="muted">{{ lyrics.versions.length }} 个版本</span>
      </h2>
      <Button variant="primary" @click="lyrics.edit()">＋ 添加版本</Button>
    </div>
    <template v-if="lyrics.selected">
      <div class="lyric-toolbar">
        <BaseSelect v-model="lyrics.selectedId" :options="lyrics.options" label="选择歌词版本" />
        <div class="button-group">
          <Button variant="secondary" :disabled="lyrics.busy" @click="lyrics.edit(lyrics.selected)">
            编辑
          </Button>
          <Button
            variant="secondary"
            v-if="!lyrics.selected.is_default"
            :disabled="lyrics.busy"
            @click="lyrics.setDefault"
          >
            设为默认
          </Button>
          <Button variant="secondary" @click="lyrics.download">下载</Button>
          <button
            v-if="lyrics.selected.user_id === sign.user?.id || sign.canModerate"
            :disabled="lyrics.busy"
            class="text-button danger"
            @click="lyrics.remove"
          >
            删除
          </button>
        </div>
      </div>
      <p class="hint">
        {{ lyricKinds.find((kind) => kind.value === lyrics.selected?.kind)?.label }} ·
        {{ lyrics.selected.language }}
        <span v-if="lyrics.selected.source_format === 'sylt'"> · 内嵌同步歌词</span>
        <span v-if="lyrics.selected.source"> · 来源：{{ lyrics.selected.source }}</span>
        · {{ date(lyrics.selected.updated_at) }}
      </p>
      <Tabs variant="segmented" class="lyric-display">
        <button :class="{ active: !lyrics.raw }" @click="lyrics.raw = false">阅读</button>
        <button :class="{ active: lyrics.raw }" @click="lyrics.raw = true">原文与时间标签</button>
      </Tabs>
      <pre>{{ lyrics.raw ? lyrics.selected.content : lyrics.preview }}</pre>
    </template>
    <EmptyState v-else compact symbol="♩" as="h3" title="暂无歌词">
      可以添加纯文本、逐行或逐字同步歌词，也可以保留不同语言的版本。
      <template #actions>
        <Button variant="secondary" @click="lyrics.edit()">添加歌词</Button>
      </template>
    </EmptyState>
  </Card>
</template>

<style scoped src="./lyrics.css"></style>
