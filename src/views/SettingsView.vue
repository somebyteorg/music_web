<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { accountApi } from '@/lib/api/account'
import type { PlaybackLibrarySettings, User } from '@/types/session'
import { useSignStore } from '@/stores/sign'
import { notify, useAction } from '@/composables/useFeedback'
import { displayName, qualities } from '@/utils/format'

const sign = useSignStore()
const { busy, run } = useAction()
const pseudonym = ref(sign.user?.pseudonym || '')
const quality = ref(sign.user?.quality || 'high')
const libraries = ref<PlaybackLibrarySettings['libraries']>([])
const selectedLibraries = ref<number[]>([])
const librariesBusy = ref(true)
const librariesError = ref('')
const { busy: savingLibraries, run: runLibraries } = useAction()

async function loadLibraries() {
  librariesBusy.value = true
  librariesError.value = ''
  try {
    const result = await accountApi.profileLibraries<PlaybackLibrarySettings>()
    libraries.value = result.libraries
    selectedLibraries.value = result.library_ids
  } catch (e) {
    librariesError.value = e instanceof Error ? e.message : '获取媒体库设置失败，请重试。'
  } finally {
    librariesBusy.value = false
  }
}

async function saveLibraries() {
  await runLibraries(async () => {
    const result = await accountApi.updateProfileLibraries<PlaybackLibrarySettings>(
      selectedLibraries.value,
    )
    libraries.value = result.libraries
    selectedLibraries.value = result.library_ids
    notify('播放媒体库已保存。')
  })
}

onMounted(loadLibraries)

async function save() {
  await run(async () => {
    const r = await accountApi.updateProfile<{ user: User }>({
      pseudonym: pseudonym.value || null,
      quality: quality.value,
    })
    sign.user = r.user
    notify('设置已保存。')
  })
}
</script>
<template>
  <div class="page-heading">
    <div>
      <h1>个人设置</h1>
    </div>
  </div>
  <form class="panel settings-card form-stack" @submit.prevent="save">
    <h2>当前用户：{{ displayName(sign.user || undefined) }}</h2>
    <label>显示名称<input v-model="pseudonym" maxlength="30" placeholder="输入显示名称" /></label>
    <p class="hint">不填时使用 EMOS 用户名。操作记录也会显示这个名字。</p>
    <h2>默认音质</h2>
    <div class="quality-options">
      <label v-for="(label, key) in qualities" :key="key" :class="{ selected: quality === key }"
        ><input v-model="quality" :value="key" name="quality" type="radio" /><strong>{{
          label
        }}</strong
        ><span>{{
          key === 'standard'
            ? '文件较小'
            : key === 'high'
              ? '适合日常播放'
              : key === 'lossless'
                ? '无损音频'
                : '更高的采样率或位深'
        }}</span></label
      >
    </div>
    <p class="hint">
      网页和客户端都会使用这个设置。没有所选音质时，播放默认音频。音频按原文件播放。
    </p>
    <button :disabled="busy" class="button primary">
      {{ busy ? '正在保存…' : '保存设置' }}
    </button>
  </form>
  <form class="panel settings-card form-stack library-settings" @submit.prevent="saveLibraries">
    <h2 id="playback-libraries-heading">播放媒体库</h2>
    <p class="hint">选择在播放器和客户端中显示的媒体库，至少选择一个。</p>
    <p v-if="librariesBusy" class="hint" role="status">正在加载媒体库…</p>
    <p v-else-if="librariesError" class="error-text" role="alert">
      {{ librariesError }}
      <button class="text-button" type="button" @click="loadLibraries">重新加载</button>
    </p>
    <fieldset
      v-else-if="libraries.length"
      :disabled="savingLibraries"
      aria-labelledby="playback-libraries-heading"
      class="quality-options library-options"
    >
      <label
        v-for="library in libraries"
        :key="library.id"
        :class="{ selected: selectedLibraries.includes(library.id) }"
      >
        <input v-model="selectedLibraries" :value="library.id" type="checkbox" />
        <strong>{{ library.name }}</strong>
      </label>
    </fieldset>
    <p v-else class="hint">暂无可选择的媒体库。</p>
    <button
      :disabled="librariesBusy || !!librariesError || savingLibraries || !selectedLibraries.length"
      class="button primary"
    >
      {{ savingLibraries ? '正在保存…' : '保存播放媒体库' }}
    </button>
  </form>
</template>

<style scoped>
.settings-card {
  width: 100%;
  padding: 20px;
}
.settings-card h2 {
  margin-top: 6px;
}
.settings-card h2:first-child {
  margin-top: 0;
}
.settings-card > .button {
  align-self: flex-start;
  margin-top: 4px;
}
.library-settings {
  margin-top: 20px;
}
.quality-options.library-options {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  margin: 0;
  padding: 0;
  border: 0;
}
.quality-options {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.quality-options label {
  position: relative;
  cursor: pointer;
  gap: 5px;
  padding: 12px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.quality-options label.selected {
  border-color: #baa2e2;
  background: #f6f2fc;
}
.quality-options input {
  position: absolute;
  top: 8px;
  right: 7px;
  width: 12px;
  height: 12px;
}
.quality-options strong {
  font-size: 12px;
  padding-right: 12px;
}
.quality-options span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
}
@media (max-width: 540px) {
  .settings-card {
    padding: 16px;
  }
  .quality-options {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
