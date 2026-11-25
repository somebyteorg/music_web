<script lang="ts" setup>
import { ref, watch } from 'vue'
import api from '@/utils/ky'
import type { CatalogType, Entity } from '@/types/catalog'
import BaseDialog from './BaseDialog.vue'
import { notify, useAction } from '@/composables/useFeedback'

const open = defineModel<boolean>({ default: false })
const props = defineProps<{ item: Entity; type: CatalogType }>()
const { busy, run } = useAction()
const query = ref('')
const todbId = ref('')
const results = ref<Record<string, unknown>[]>([])
const preview = ref<Record<string, unknown> | null>(null)
const selected = ref<string[]>([])
const conflict = ref<Entity | null>(null)
const labels: Record<string, string> = {
  name: '名称',
  description: '简介',
  image_url: '封面图片',
  release_date: '发行日期',
}
watch(open, (v) => {
  if (v) {
    query.value = props.item.name
    todbId.value = props.item.todb_id || ''
    preview.value = null
    results.value = []
    conflict.value = null
  }
})
async function search() {
  await run(async () => {
    const r = await api
      .get(`metadata/${props.type}/search`, { searchParams: { q: query.value } })
      .json<Record<string, unknown>>()
    const data = r.data || r.items || r.list || r.results || r
    results.value = (Array.isArray(data) ? data : []) as Record<string, unknown>[]
    if (!results.value.length) notify('没有找到结果，可以直接输入 todb ID。')
  })
}
function currentValue(key: string | number) {
  return String(
    (props.item as unknown as Record<string, unknown>)[String(key)] || '尚未填写',
  ).slice(0, 220)
}
function idOf(row: Record<string, unknown>) {
  return String(row.id || row.music_song_id || row.music_album_id || row.person_id || '')
}
async function getPreview() {
  await run(async () => {
    const r = await api
      .get(`catalog/${props.type}/${props.item.id}/metadata`, {
        searchParams: { todb_id: todbId.value },
      })
      .json<{ fields: Record<string, unknown>; conflict: Entity | null }>()
    preview.value = r.fields
    selected.value = []
    conflict.value = r.conflict
  })
}
async function apply() {
  await run(async () => {
    await api.post(`catalog/${props.type}/${props.item.id}/metadata`, {
      json: { todb_id: todbId.value, version: props.item.version, fields: selected.value },
    })
    notify('已提交更新，完成后可在消息中查看结果。')
    open.value = false
  })
}
</script>
<template>
  <BaseDialog v-model="open" :busy="busy" title="从 todb 导入资料"
    ><div class="form-stack">
      <p class="hint">选择想更新的字段，未勾选的本地资料会保留。只建立关联也可以。</p>
      <label
        >搜索资料
        <div class="search-inline">
          <input
            v-model="query"
            placeholder="输入歌曲、专辑或歌手名称"
            @keydown.enter.prevent="search"
          /><button :disabled="busy || !query" class="button secondary" @click="search">
            搜索
          </button>
        </div></label
      >
      <div v-if="results.length" class="picker-results">
        <button
          v-for="(row, i) in results"
          :key="i"
          @click="
            () => {
              todbId = idOf(row)
              preview = null
            }
          "
        >
          {{ row.name || row.title }} <small>#{{ idOf(row) }}</small>
        </button>
      </div>
      <label
        >todb ID
        <div class="search-inline">
          <input
            v-model="todbId"
            inputmode="numeric"
            placeholder="填写 todb 的条目 ID"
            @input="preview = null"
          /><button :disabled="busy || !todbId" class="button secondary" @click="getPreview">
            预览资料
          </button>
        </div></label
      >
      <div v-if="conflict" class="notice error">
        这条 todb 资料已关联「{{ conflict.name }}」，请先在详情页合并重复资料。<RouterLink
          :to="`/${type}/${conflict.id}`"
          @click="open = false"
          >查看详情 ↗</RouterLink
        >
      </div>
      <div v-if="preview" class="metadata-fields">
        <label v-for="(value, key) in preview" :key="key" class="metadata-field"
          ><input v-model="selected" :value="key" type="checkbox" />
          <div>
            <strong>{{ labels[key] || key }}</strong>
            <p class="muted">现在：{{ currentValue(key) }}</p>
            <p>更新为：{{ String(value || '留空').slice(0, 500) }}</p>
          </div></label
        >
      </div>
    </div>
    <template #footer
      ><button :disabled="busy" class="button secondary" @click="open = false">取消</button
      ><button :disabled="busy || !preview || !!conflict" class="button primary" @click="apply">
        {{ selected.length ? '关联并更新所选资料' : '只建立关联' }}
      </button></template
    ></BaseDialog
  >
</template>

<style scoped>
.metadata-field {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--space-12);
  padding: var(--space-12);
  margin-top: 8px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}
.metadata-field > div {
  min-width: 0;
}
.metadata-field p {
  margin-top: 5px;
  max-height: 130px;
  overflow: auto;
  overflow-wrap: anywhere;
  font-size: var(--font-sm);
}
.metadata-field strong {
  font-size: var(--font-base);
}
</style>
