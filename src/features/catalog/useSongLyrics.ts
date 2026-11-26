import { computed, ref, type Ref, watch } from 'vue'
import { catalogApi } from '@/lib/api/catalog'
import type { Entity } from '@/types/catalog'
import type { LyricFormat, LyricKind, LyricVersion } from '@/types/lyrics'
import { notify, useAction } from '@/composables/useFeedback'
import { detectLyricFormat, prepareLyrics } from '@/utils/lyrics'

export const lyricFormats: { value: LyricFormat; label: string }[] = [
  { value: 'text', label: '纯文本' },
  { value: 'lrc', label: 'LRC · 逐行同步' },
  { value: 'elrc', label: '逐字 LRC' },
  { value: 'ttml', label: 'TTML' },
]
export const lyricKinds: { value: LyricKind; label: string }[] = [
  { value: 'main', label: '原文' },
  { value: 'translation', label: '翻译' },
  { value: 'pronunciation', label: '音译' },
]

export function useSongLyrics(item: Ref<Entity | undefined>) {
  const selectedId = ref('')
  const editor = ref(false)
  const removing = ref(false)
  const reason = ref('')
  const editingId = ref('')
  const raw = ref(false)
  const version = ref(0)
  const { busy, run } = useAction()
  const blank = () => ({
    name: '',
    format: 'lrc' as LyricFormat,
    kind: 'main' as LyricKind,
    language: 'und',
    source: '',
    content: '',
    is_default: false,
  })
  const form = ref(blank())
  const versions = computed(() => item.value?.lyrics || [])
  const selected = computed(() => versions.value.find((lyric) => lyric.id === selectedId.value))
  const preview = computed(() => {
    const lyric = selected.value
    if (!lyric) return ''
    if (lyric.format === 'ttml') {
      const document = new DOMParser().parseFromString(lyric.content, 'application/xml')
      return Array.from(document.getElementsByTagNameNS('*', 'p'))
        .map((line) => line.textContent)
        .join('\n')
    }
    if (lyric.format === 'text') return lyric.content
    return lyric.content
      .split('\n')
      .filter((line) => !/^\[(?:[a-z]+):[^\]]*\]\s*$/i.test(line))
      .map((line) => line.replace(/\[\d+:\d{2}(?:[.:]\d+)?\]|<\d+:\d{2}(?:\.\d+)?>/g, ''))
      .join('\n')
  })
  const options = computed(() =>
    versions.value.map((lyric) => ({
      value: lyric.id,
      label: `${lyric.name} · ${lyricFormats.find((format) => format.value === lyric.format)?.label} · ${lyric.language}${lyric.is_default ? ' · 默认' : ''}`,
    })),
  )
  watch(
    versions,
    (entries) => {
      if (!entries.some((entry) => entry.id === selectedId.value))
        selectedId.value = (entries.find((entry) => entry.is_default) || entries[0])?.id || ''
    },
    { immediate: true },
  )

  function edit(lyric?: LyricVersion) {
    editingId.value = lyric?.id || ''
    version.value = item.value?.version || 0
    form.value = lyric
      ? {
          name: lyric.name,
          format: lyric.format,
          kind: lyric.kind,
          language: lyric.language,
          source: lyric.source,
          content: lyric.content,
          is_default: lyric.is_default,
        }
      : { ...blank(), is_default: versions.value.length === 0 }
    editor.value = true
  }
  function apply(result: { lyrics: LyricVersion[]; version: number }) {
    if (item.value) {
      item.value.lyrics = result.lyrics
      item.value.version = result.version
    }
  }
  async function save() {
    await run(async () => {
      if (!item.value) return
      const result = await catalogApi.saveLyrics<{ lyrics: LyricVersion[]; version: number }>(
        item.value.id,
        editingId.value || null,
        { ...prepareLyrics(form.value), version: version.value },
      )
      apply(result)
      selectedId.value = editingId.value || result.lyrics.at(-1)?.id || ''
      editor.value = false
      notify('歌词版本已保存。')
    })
  }
  async function setDefault() {
    await run(async () => {
      if (!item.value || !selected.value) return
      apply(
        await catalogApi.defaultLyric<{ lyrics: LyricVersion[]; version: number }>(
          item.value.id,
          selected.value.id,
          { version: item.value.version },
        ),
      )
      notify('默认歌词已更新。')
    })
  }
  function remove() {
    reason.value = ''
    version.value = item.value?.version || 0
    editingId.value = selected.value?.id || ''
    removing.value = true
  }
  async function destroy() {
    await run(async () => {
      if (!item.value || !editingId.value) return
      apply(
        await catalogApi.removeLyric<{ lyrics: LyricVersion[]; version: number }>(
          item.value.id,
          editingId.value,
          { version: version.value, reason: reason.value },
        ),
      )
      removing.value = false
      notify('歌词已删除，可从操作记录中恢复。')
    })
  }
  async function importFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    await run(async () => {
      if (file.size > 400000) throw new Error('歌词文件过大，请选择 400 KB 以内的 UTF-8 文本文件。')
      const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
      if (content.length > 100000) throw new Error('歌词内容不能超过 100000 个字符。')
      form.value.content = content
      form.value.format = detectLyricFormat(content, file.name)
      if (!form.value.name) form.value.name = file.name.replace(/\.[^.]+$/, '').slice(0, 100)
      if (!form.value.source) form.value.source = file.name.slice(0, 500)
    })
  }
  function download() {
    if (!selected.value) return
    const lyric = selected.value
    const url = URL.createObjectURL(new Blob([lyric.content], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${item.value?.name || '歌词'}-${lyric.name}.${lyric.format === 'text' ? 'txt' : lyric.format}`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return {
    selectedId,
    selected,
    versions,
    options,
    editor,
    removing,
    reason,
    editingId,
    raw,
    preview,
    form,
    busy,
    edit,
    save,
    setDefault,
    remove,
    destroy,
    importFile,
    download,
  }
}
