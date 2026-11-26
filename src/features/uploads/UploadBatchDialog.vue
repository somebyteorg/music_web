<script lang="ts" setup>
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import EntityCover from '@/components/EntityCover.vue'
import { fileUrl } from '@/utils/file'
import { duration, qualities } from '@/utils/format'
import type { UploadBatch } from './useUploadBatch'
import type { BatchAlbum, BatchRow } from './batchModel'
import type { UploadTask } from './model'
import { publicAlbumFields } from './publicAlbumPage'

const props = defineProps<{ batch: UploadBatch }>()
const addingAlbum = ref(false)
const albumName = ref('')
const albumNameInput = useTemplateRef<HTMLInputElement>('albumNameInput')
const groupingOptions = [
  { value: 'folder' as const, label: '按文件夹分组' },
  { value: 'album' as const, label: '按专辑标签分组' },
]
function preventUnexpectedEnter(event: KeyboardEvent) {
  if (!(event.target instanceof HTMLInputElement) || event.isComposing || event.keyCode === 229)
    return
  event.preventDefault()
  event.stopPropagation()
}
async function startAlbumGroup() {
  addingAlbum.value = true
  await nextTick()
  albumNameInput.value?.focus()
}
function confirmAlbumGroup() {
  if (props.batch.addAlbum(albumName.value)) {
    addingAlbum.value = false
    albumName.value = ''
  }
}
function updateSongArtist(row: BatchRow, event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  row.artist = event.target.value
  props.batch.clearSongCredits(row)
}
watch(
  () => props.batch.open,
  () => {
    addingAlbum.value = false
    albumName.value = ''
  },
)
const emit = defineEmits<{
  preview: [task: UploadTask]
  'browse-images': [album: BatchAlbum]
  inspect: [picture: ReturnType<UploadBatch['pictures']>[number], album: BatchAlbum]
}>()
</script>
<template>
  <BaseDialog v-model="batch.open" :busy="batch.busy" title="批量整理音频" wide>
    <form class="form-stack" novalidate @submit.prevent @keydown.enter="preventUnexpectedEnter">
      <label
        >新建歌曲所属媒体库<BaseSelect
          v-model="batch.form.libraryId"
          :disabled="batch.busy || batch.libraries.busy"
          :options="batch.libraries.options"
          label="上传歌曲所属媒体库"
      /></label>
      <p class="hint">关联已有歌曲时保留其媒体库，新增的专辑收录不会移除其他专辑关联。</p>
      <p v-if="batch.libraries.error" class="error-text">
        {{ batch.libraries.error }}
        <button type="button" class="text-button" @click="batch.libraries.load(true)">重试</button>
      </p>
      <label
        >音频分组<BaseSelect
          :model-value="batch.grouping"
          :options="groupingOptions"
          :disabled="batch.busy || batch.done > 0"
          label="音频分组方式"
          @update:model-value="batch.regroup"
      /></label>
      <p class="hint">
        每组确认专辑归属即可入库。CD1、CD2
        等子目录会合在一起；切换分组保留歌曲信息，专辑归属请重新核对。
      </p>
      <fieldset :disabled="batch.busy" class="batch-common">
        <div>
          <label class="check-label"
            ><input v-model="batch.form.applyArtist" type="checkbox" />统一歌曲演唱者</label
          ><input
            v-model="batch.form.artist"
            :disabled="!batch.form.applyArtist"
            aria-label="批量填写歌曲演唱者"
            maxlength="255"
            placeholder="保留每首演唱者时无需勾选"
          />
        </div>
        <div>
          <label class="check-label"
            ><input v-model="batch.form.applyVersion" type="checkbox" />统一录音版本</label
          ><input
            v-model="batch.form.version"
            :disabled="!batch.form.applyVersion"
            aria-label="批量填写录音版本"
            maxlength="100"
            placeholder="现场、混音、重制等"
          />
        </div>
      </fieldset>
      <p class="hint">统一填写仅应用于新建歌曲；关联已有歌曲时保留原来的歌手和录音版本。</p>
      <section v-for="album in batch.albums" :key="album.key" class="album-confirmation">
        <div class="album-confirmation-heading">
          <EntityCover
            :item="{
              id: batch.selectedAlbum(album)?.id || '',
              name: album.name,
              cover_id: batch.coverId(album),
              image_url: !album.replaceCover ? batch.selectedAlbum(album)?.image_url : undefined,
            }"
          />
          <div>
            <h3>{{ batch.groupTitle(album) }}</h3>
            <p class="hint">
              {{
                album.selection === 'none'
                  ? '作为单曲入库'
                  : batch.selectedAlbum(album)?.name || album.artist_name || '请确认专辑归属'
              }}<span v-if="album.selection !== 'none' && album.release_year">
                · {{ album.release_year }}</span
              >
              · 已选 {{ batch.groupEntries(album).length }} 份音频<span
                v-if="album.selection !== 'none' && album.total_tracks"
              >
                / 标签共 {{ album.total_tracks }} 首</span
              ><span v-if="album.selection !== 'none' && album.total_discs">
                · {{ album.total_discs }} 张碟</span
              >
            </p>
          </div>
        </div>
        <label
          >专辑归属<BaseSelect
            v-model="album.selection"
            :disabled="batch.busy || album.loading"
            :label="`${album.name || '本组'} 的专辑归属`"
            :options="batch.albumOptions(album)"
            @update:model-value="batch.changeAlbum(album)"
        /></label>
        <p v-if="album.needsReview && !album.selection" class="notice">
          本组的专辑标签不一致，请选择专辑归属，或作为单曲入库。
        </p>
        <p v-if="album.selection === 'none'" class="hint">
          新建歌曲作为单曲入库；已有歌曲保留原来的专辑收录。
        </p>
        <div v-if="batch.albums.length > 1 && !batch.form.applyArtist" class="group-performer">
          <label class="check-label"
            ><input
              v-model="album.applyArtist"
              type="checkbox"
              :disabled="batch.busy"
            />统一本组演唱者</label
          >
          <input
            v-model="album.performer"
            :disabled="batch.busy || !album.applyArtist"
            :aria-label="`${batch.groupTitle(album)} 的统一演唱者`"
            maxlength="255"
            placeholder="本组歌曲使用同一位歌手时填写"
          />
        </div>
        <p v-if="album.loading" class="hint" role="status">正在匹配已有专辑…</p>
        <p v-if="album.error" class="error-text">{{ album.error }}</p>
        <p v-if="!album.selection && album.matches.length" class="notice">
          存在多张候选或发行资料不同，请核对后选择。
        </p>
        <details v-if="album.selection !== 'none'" class="batch-details musicbrainz-import">
          <summary>从 MusicBrainz 获取专辑资料</summary>
          <div class="form-stack">
            <p class="hint">
              搜索公开发行资料，预览后再填入本组。仅在曲名或曲序能唯一对应时更新曲目；其余保留原值。
            </p>
            <div class="form-grid">
              <label
                >专辑搜索词<input
                  v-model="album.musicBrainzQuery"
                  maxlength="255"
                  placeholder="专辑名称"
              /></label>
              <label
                >歌手筛选<input v-model="album.artist_name" maxlength="255" placeholder="可留空"
              /></label>
            </div>
            <div class="button-group">
              <button
                class="button small secondary"
                type="button"
                :disabled="
                  batch.busy ||
                  album.musicBrainzLoading ||
                  (!album.musicBrainzQuery.trim() && !album.name.trim())
                "
                @click="batch.searchMusicBrainz(album)"
              >
                {{ album.musicBrainzLoading ? '正在查询…' : '搜索发行版本' }}
              </button>
              <span class="hint">搜索受服务器限流；短时间重复查询会复用缓存。</span>
            </div>
            <p v-if="album.musicBrainzError" class="error-text" role="alert">
              {{ album.musicBrainzError }}
            </p>
            <div v-if="album.musicBrainzResults.length" class="picker-results">
              <button
                v-for="release in album.musicBrainzResults"
                :key="release.id"
                :class="{ selected: album.musicBrainzPreview?.id === release.id }"
                :disabled="batch.busy || album.musicBrainzLoading"
                type="button"
                @click="batch.selectMusicBrainz(album, release)"
              >
                <strong>{{ release.title }}</strong>
                <small>
                  {{ release.artist_name || '未知歌手' }} · {{ release.date || '日期未知' }}
                  {{ release.country ? `· ${release.country}` : '' }}
                  {{ release.track_count ? `· ${release.track_count} 首` : '' }} ·
                  {{ release.status || '发行状态未知' }}
                </small>
              </button>
            </div>
            <article v-if="album.musicBrainzPreview" class="musicbrainz-preview">
              <img
                v-if="album.musicBrainzPreview.cover_preview_url"
                :src="album.musicBrainzPreview.cover_preview_url"
                :alt="`${album.musicBrainzPreview.title} 封面预览`"
                loading="lazy"
              />
              <div class="musicbrainz-preview-content">
                <strong>{{ album.musicBrainzPreview.title }}</strong>
                <p class="hint">
                  {{ album.musicBrainzPreview.artist_name || '未知歌手' }} ·
                  {{ album.musicBrainzPreview.date || '日期未知' }}
                  {{
                    album.musicBrainzPreview.release_country
                      ? `· ${album.musicBrainzPreview.release_country}`
                      : ''
                  }}
                  · {{ album.musicBrainzPreview.total_tracks || 0 }} 首 /
                  {{ album.musicBrainzPreview.total_discs || 0 }} 碟 ·
                  {{ album.musicBrainzPreview.status || '状态未知' }}
                </p>
                <p class="hint">
                  发行 MBID：{{ album.musicBrainzPreview.id }} · 厂牌：{{
                    album.musicBrainzPreview.label || '未知'
                  }}
                  · 编号：{{ album.musicBrainzPreview.catalog_number || '未知' }} · 格式：{{
                    album.musicBrainzPreview.formats?.join(' / ') || '未知'
                  }}
                  · 条码：{{ album.musicBrainzPreview.barcode || '未知' }} · 流派：{{
                    album.musicBrainzPreview.genre || '未知'
                  }}
                </p>
                <p class="hint">
                  艺人署名：{{
                    album.musicBrainzPreview.artist_credits
                      ?.map((credit) => credit.credited_name + credit.joinphrase)
                      .join('') || album.musicBrainzPreview.artist_name
                  }}
                </p>
                <div v-if="album.musicBrainzPreview.artworks?.length" class="musicbrainz-artworks">
                  <span v-for="art in album.musicBrainzPreview.artworks" :key="art.id"
                    ><img
                      v-if="art.preview_url"
                      :src="art.preview_url"
                      :alt="art.types.join(', ') || art.type"
                      loading="lazy"
                    /><small
                      >{{ art.type }} · {{ art.types.join(', ') || '类型未知'
                      }}{{ art.approved ? ' · 已审核' : '' }}</small
                    ></span
                  >
                </div>
                <p class="notice">
                  完整发行曲目清单仅供比对；只有当前已选本地音频对应的歌曲会入库，不会为未选曲目创建歌曲。
                </p>
                <ol v-if="album.musicBrainzPreview.tracks.length" class="musicbrainz-tracklist">
                  <li
                    v-for="track in album.musicBrainzPreview.tracks"
                    :key="`${track.disc}-${track.track}`"
                  >
                    <span>{{ track.disc }}-{{ track.track }}. {{ track.title }}</span>
                    <small
                      >{{ track.artist_name || '未知艺人' }} ·
                      {{
                        track.musicbrainz_id
                          ? `Recording ${track.musicbrainz_id}`
                          : '无 Recording ID'
                      }}{{
                        track.length_ms != null
                          ? ` · ${Math.floor(track.length_ms / 60000)}:${String(Math.floor(track.length_ms / 1000) % 60).padStart(2, '0')}`
                          : ''
                      }}{{ track.isrcs?.length ? ` · ISRC ${track.isrcs.join(', ')}` : '' }}</small
                    >
                  </li>
                </ol>
                <p v-else class="hint">来源未提供曲目列表，现有曲目信息会保留。</p>
                <div class="button-group">
                  <button
                    class="button small secondary"
                    type="button"
                    :disabled="batch.busy || album.musicBrainzLoading"
                    @click="batch.applyMusicBrainz(album)"
                  >
                    应用发行资料
                  </button>
                  <button
                    v-if="album.musicBrainzPreview.cover_preview_url"
                    class="button small secondary"
                    type="button"
                    :disabled="batch.busy || album.musicBrainzCoverLoading"
                    @click="batch.importMusicBrainzCover(album)"
                  >
                    {{ album.musicBrainzCoverLoading ? '正在导入封面…' : '明确确认后导入正面封面' }}
                  </button>
                </div>
              </div>
            </article>
            <p class="hint">
              资料来源：<a href="https://musicbrainz.org/" target="_blank" rel="noreferrer"
                >MusicBrainz</a
              >；封面来自
              <a href="https://coverartarchive.org/" target="_blank" rel="noreferrer"
                >Cover Art Archive</a
              >。 封面导入到你的图片库前，请确认具备相应使用权限；已有专辑封面不会自动替换。
            </p>
          </div>
        </details>
        <details
          v-if="album.selection !== 'none'"
          class="batch-details musicbrainz-import public-album-import"
        >
          <summary>从 QQ 音乐、网易云音乐或酷狗公开专辑页获取资料</summary>
          <div class="form-stack">
            <p class="hint">
              只读取无需登录的 HTTPS 专辑页可见资料、公开元数据和页面结构化数据；不调用平台
              API、不登录、不绕过限制，也不下载音频。读不到或不完整时，可粘贴页面可见文字。只有本组已选本地音频会匹配/入库，其他曲目仅供核对。
            </p>
            <label
              >公开专辑页链接<input
                v-model="album.publicPageUrl"
                :disabled="batch.busy || album.publicPageLoading"
                maxlength="2048"
                placeholder="粘贴 QQ 音乐、网易云音乐或酷狗的专辑详情/分享页链接"
            /></label>
            <div class="button-group">
              <button
                class="button small secondary"
                type="button"
                :disabled="batch.busy || album.publicPageLoading || !album.publicPageUrl.trim()"
                @click="batch.previewPublicAlbum(album, 'url')"
              >
                {{ album.publicPageLoading ? '正在读取公开页面…' : '读取公开页面' }}
              </button>
              <button
                class="text-button"
                type="button"
                :disabled="batch.busy || album.publicPageLoading"
                @click="album.publicPageTextVisible = !album.publicPageTextVisible"
              >
                {{ album.publicPageTextVisible ? '收起文字粘贴区' : '页面打不开？粘贴页面文字' }}
              </button>
            </div>
            <div v-if="album.publicPageTextVisible" class="form-stack">
              <label
                >粘贴页面可见的专辑资料和曲目清单<textarea
                  v-model="album.publicPageText"
                  :disabled="batch.busy || album.publicPageLoading"
                  maxlength="50000"
                  rows="7"
                  placeholder="例如：专辑名、艺人、发行时间、唱片公司，以及按碟号/曲序排列的歌名"
                />
              </label>
              <button
                class="button small secondary"
                type="button"
                :disabled="batch.busy || album.publicPageLoading || !album.publicPageText.trim()"
                @click="batch.previewPublicAlbum(album, 'text')"
              >
                {{ album.publicPageLoading ? '正在解析文字…' : '解析粘贴文字' }}
              </button>
            </div>
            <p v-if="album.publicPageError" class="error-text" role="alert">
              {{ album.publicPageError }}
            </p>
            <article
              v-if="album.publicPagePreview"
              class="musicbrainz-preview public-album-preview"
            >
              <img
                v-if="album.publicPagePreview.cover_preview_url"
                :src="album.publicPagePreview.cover_preview_url"
                :alt="`${album.publicPagePreview.title || '专辑'}封面预览`"
                loading="lazy"
                referrerpolicy="no-referrer"
              />
              <div class="musicbrainz-preview-content">
                <strong>{{ album.publicPagePreview.title || '来源未提供专辑名称' }}</strong>
                <p class="hint">
                  {{ album.publicPagePreview.source_platform }} ·
                  {{ album.publicPagePreview.method === 'pasted-text' ? '粘贴文字' : '公开页面' }}
                  <a
                    v-if="album.publicPagePreview.source_url"
                    :href="album.publicPagePreview.source_url"
                    target="_blank"
                    rel="noreferrer"
                    >打开来源页</a
                  >
                </p>
                <p class="hint">
                  {{ album.publicPagePreview.artist_name || '艺人未提供' }} ·
                  {{
                    album.publicPagePreview.release_date ||
                    album.publicPagePreview.release_year ||
                    '发行日期未知'
                  }}
                  {{
                    album.publicPagePreview.release_country
                      ? `· ${album.publicPagePreview.release_country}`
                      : ''
                  }}
                  ·
                  {{
                    album.publicPagePreview.total_tracks ||
                    album.publicPagePreview.tracks.length ||
                    '曲目数未知'
                  }}
                  首
                  {{
                    album.publicPagePreview.total_discs
                      ? `· ${album.publicPagePreview.total_discs} 碟`
                      : ''
                  }}
                </p>
                <p class="hint">
                  厂牌：{{ album.publicPagePreview.label || '未提供' }} · 编号：{{
                    album.publicPagePreview.catalog_number || '未提供'
                  }}
                  · 流派：{{ album.publicPagePreview.genre || '未提供' }}
                </p>
                <p class="hint">
                  条码：{{ album.publicPagePreview.barcode || '未提供' }} · 格式：{{
                    album.publicPagePreview.formats.join(' / ') || '未提供'
                  }}
                </p>
                <p v-if="album.publicPagePreview.description" class="hint public-album-description">
                  简介（仅预览）：{{ album.publicPagePreview.description }}
                </p>
                <p v-if="album.publicPagePreview.warning" class="notice">
                  {{ album.publicPagePreview.warning }}
                </p>
                <ol
                  v-if="album.publicPagePreview.tracks.length"
                  class="musicbrainz-tracklist public-album-tracklist"
                >
                  <li
                    v-for="track in album.publicPagePreview.tracks"
                    :key="`${track.disc}-${track.track}`"
                  >
                    <span>{{ track.disc }}-{{ track.track }}. {{ track.title }}</span>
                    <small>
                      {{ track.artist_name || album.publicPagePreview.artist_name || '艺人未提供' }}
                      {{
                        track.length_ms != null
                          ? ` · ${Math.floor(track.length_ms / 60000)}:${String(Math.floor(track.length_ms / 1000) % 60).padStart(2, '0')}`
                          : ''
                      }}
                    </small>
                  </li>
                </ol>
                <p v-else class="hint">来源未提供曲目清单；不会据此为未选本地音频创建歌曲。</p>
                <p v-if="album.publicPagePreview.cover_preview_url" class="hint">
                  封面仅为网页预览，不会自动下载或替换。若有权使用，请自行选择本地图片上传。
                </p>
                <p
                  v-if="
                    album.publicPagePreview.barcode ||
                    album.publicPagePreview.formats.length ||
                    album.publicPagePreview.description
                  "
                  class="hint"
                >
                  条码、格式和简介当前仅供核对；EmoS 目录没有对应可写字段。国内平台页面 ID 不会写入
                  MusicBrainz ID。
                </p>
                <div class="button-group">
                  <button
                    class="button small secondary"
                    type="button"
                    :disabled="
                      batch.busy ||
                      album.publicPageLoading ||
                      (!album.publicPagePreview.title && !album.publicPagePreview.tracks.length)
                    "
                    :aria-disabled="!album.publicPageFields.length"
                    @click="batch.applyPublicAlbumPage(album)"
                  >
                    应用勾选资料并匹配本地音频
                  </button>
                </div>
                <fieldset :disabled="batch.busy || album.publicPageLoading" class="form-grid">
                  <legend>选择要填入的字段（来源为空时保留原值）</legend>
                  <label v-for="field in publicAlbumFields" :key="field.key" class="check-label">
                    <input v-model="album.publicPageFields" type="checkbox" :value="field.key" />
                    {{ field.label }}
                  </label>
                </fieldset>
              </div>
            </article>
          </div>
        </details>
        <ul v-if="batch.selectedAlbum(album)?.conflicts.length" class="preview-warnings">
          <li v-for="conflict in batch.selectedAlbum(album)?.conflicts" :key="conflict">
            {{ conflict }}
          </li>
        </ul>
        <div v-if="!album.selection || album.selection === 'new'" class="form-stack">
          <div class="form-grid">
            <label
              >专辑名称<input
                v-model="album.name"
                :disabled="batch.busy"
                maxlength="255"
                placeholder="专辑名称" /></label
            ><label
              >专辑艺人<input
                v-model="album.artist_name"
                @input="batch.clearAlbumCredits(album)"
                :disabled="batch.busy"
                maxlength="255"
                placeholder="专辑主艺人；合辑可填写 Various Artists"
            /></label>
          </div>
          <p v-if="album.inferredArtist" class="hint">
            文件未提供专辑艺人，请核对；歌曲演唱者会分别保留。
          </p>
          <details class="batch-details">
            <summary>发行信息（选填）</summary>
            <div class="form-stack">
              <div class="form-grid">
                <label
                  >发行年份<input
                    v-model.number="album.release_year"
                    max="9999"
                    min="1000"
                    placeholder="未知可留空"
                    type="number" /></label
                ><label
                  >发行版本<input
                    v-model="album.edition"
                    maxlength="100"
                    placeholder="如：首版、重制版、豪华版" /></label
                ><label>发行地区<input v-model="album.release_country" maxlength="100" /></label
                ><label>唱片编号<input v-model="album.catalog_number" maxlength="100" /></label
                ><label>完整发行日期<input v-model="album.release_date" type="date" /></label
                ><label>流派<input v-model="album.genre" maxlength="100" /></label
                ><label>厂牌<input v-model="album.label" maxlength="255" /></label>
              </div>
              <div class="form-grid">
                <label
                  >碟片总数<input
                    v-model.number="album.total_discs"
                    max="999"
                    min="1"
                    placeholder="未知可留空"
                    type="number" /></label
                ><label
                  >曲目总数<input
                    v-model.number="album.total_tracks"
                    max="9999"
                    min="1"
                    placeholder="整张专辑的总曲目数"
                    type="number" /></label
                ><label
                  >MusicBrainz 发行 ID<input
                    v-model="album.musicbrainz_id"
                    maxlength="36"
                    placeholder="未知可留空"
                /></label>
              </div>
              <button
                :disabled="batch.busy || album.loading || !album.name.trim()"
                class="button small secondary"
                type="button"
                @click="batch.searchAlbums(album)"
              >
                重新查找已有专辑
              </button>
            </div>
          </details>
        </div>
        <details v-if="album.selection && album.selection !== 'none'" class="batch-details">
          <summary>封面与附图</summary>
          <div class="form-stack">
            <label
              >{{
                batch.selectedAlbum(album) && !album.replaceCover
                  ? '补充图片中的正面图'
                  : '专辑封面'
              }}<BaseSelect
                v-model="album.coverChoice"
                :disabled="batch.busy"
                :label="`${album.name} 的封面`"
                :options="batch.coverOptions(album)"
            /></label>
            <label
              v-if="batch.selectedAlbum(album)?.cover_id || batch.selectedAlbum(album)?.image_url"
              class="check-label"
              ><input
                v-model="album.replaceCover"
                :disabled="batch.busy"
                type="checkbox"
              />替换已有专辑封面</label
            >
            <p v-if="batch.selectedAlbum(album)" class="hint">
              {{
                album.replaceCover
                  ? '入库时使用所选图片替换专辑封面。'
                  : '保留当前封面；所选图片作为附图补充。'
              }}
            </p>
            <label class="check-label"
              ><input
                v-model="album.includeArtwork"
                :disabled="batch.busy"
                type="checkbox"
              />包含目录中的封底、碟面和内页</label
            >
            <p v-if="batch.assetsLoading" class="hint">正在加载目录图片…</p>
            <p v-if="batch.assetsError" class="error-text" role="alert">
              {{ batch.assetsError }}
              <button
                :disabled="batch.assetsLoading"
                class="text-button"
                type="button"
                @click="batch.hydratePictures"
              >
                重试
              </button>
            </p>
            <div class="image-grid">
              <article
                v-for="picture in batch.pictures(album)"
                :key="picture.id"
                :class="{ selected: batch.pictureId(album) === picture.id }"
                class="image-card"
              >
                <button
                  :aria-label="`预览 ${picture.name}`"
                  :disabled="picture.waiting || batch.busy"
                  class="image-thumbnail"
                  type="button"
                  @click="emit('inspect', picture, album)"
                >
                  <img
                    v-if="!picture.waiting"
                    :src="fileUrl(picture.id)"
                    alt=""
                    loading="lazy"
                  /><span v-else>等待上传</span>
                </button>
                <span :title="picture.name">{{ picture.name }}</span>
                <div class="button-group">
                  <button
                    :disabled="picture.waiting || batch.busy"
                    class="text-button"
                    type="button"
                    @click="album.coverChoice = picture.id"
                  >
                    {{
                      batch.pictureId(album) === picture.id ? '已选正面图' : '选为正面图'
                    }}</button><button
                    :disabled="batch.busy || picture.waiting"
                    class="text-button"
                    type="button"
                    @click="batch.removePicture(album, picture.id)"
                  >
                    移除
                  </button>
                </div>
              </article>
            </div>
            <p v-if="album.excludedPictureIds.length" class="hint">
              已移除 {{ album.excludedPictureIds.length }} 张候选图，文件仍保留。<button
                :disabled="batch.busy"
                class="text-button"
                type="button"
                @click="album.excludedPictureIds = []"
              >
                恢复候选图
              </button>
            </p>
            <button
              :disabled="batch.busy"
              class="text-button"
              type="button"
              @click="emit('browse-images', album)"
            >
              从我的图片选择
            </button>
            <label class="text-link album-cover-upload"
              >另选封面图片<input
                :disabled="batch.busy"
                accept="image/jpeg,image/png,image/webp"
                type="file"
                @change="batch.uploadCover(album, $event)"
            /></label>
          </div>
        </details>
        <div
          v-if="
            album.selection &&
            album.selection !== 'none' &&
            batch.groupEntries(album).some(({ task }) => task.state === 'ready')
          "
          class="track-numbering"
        >
          <p class="hint">
            缺失或重复的曲序会自动补齐；已有曲目保留原位，同一首歌的多种音质共用曲序。
          </p>
          <div class="track-numbering-actions">
            <label class="batch-number"
              >起始曲序<input
                v-model.number="album.trackStart"
                type="number"
                min="1"
                max="9999"
                :disabled="batch.busy || batch.numbering.includes(album.key)"
            /></label>
            <button
              type="button"
              class="button small secondary"
              :disabled="batch.busy || batch.numbering.includes(album.key)"
              @click="batch.numberTracks(album)"
            >
              {{ batch.numbering.includes(album.key) ? '正在检查曲序…' : '从此曲序重新递增' }}
            </button>
            <button
              type="button"
              class="text-button"
              :disabled="batch.busy || batch.numbering.includes(album.key)"
              @click="batch.numberTracks(album, false)"
            >
              只补齐缺失和重复
            </button>
            <button
              v-if="batch.canUndoNumbers(album)"
              type="button"
              class="text-button"
              @click="batch.undoNumbers(album)"
            >
              撤销本次编号
            </button>
          </div>
          <p class="hint">重新编号按下方文件顺序排列，每张碟分别递增，并跳过已有位置。</p>
        </div>
        <p v-if="batch.numberingErrors[album.key]" class="error-text" role="alert">
          {{ batch.numberingErrors[album.key] }}
        </p>
        <p v-for="problem in batch.problems(album)" :key="problem" class="error-text">
          {{ problem }}
        </p>
        <p
          v-if="
            (album.applyArtist || batch.form.applyArtist) &&
            batch
              .groupEntries(album)
              .some(({ row }) => !row.choice.startsWith('track:') && !batch.songArtist(row))
          "
          class="error-text"
        >
          请填写统一使用的歌手，或取消统一填写。
        </p>
        <p v-if="batch.groupEntries(album).length" class="hint group-track-preview">
          {{
            batch
              .groupEntries(album)
              .slice(0, 3)
              .map(({ row }) => row.title)
              .join('、')
          }}{{ batch.groupEntries(album).length > 3 ? '…' : '' }}
        </p>
        <p v-else class="hint">分组已建好，可展开其他分组的曲目，或整组移动音频到这里。</p>
        <details
          v-if="batch.groupEntries(album).length"
          class="batch-details"
          :open="
            batch.groupEntries(album).some(({ row, task }) => !row.title.trim() || !!task.error)
          "
        >
          <summary>曲目与逐首编辑（{{ batch.groupEntries(album).length }} 份）</summary>
          <fieldset :disabled="batch.busy" class="batch-files">
            <article
              v-for="entry in batch.groupEntries(album)"
              :key="entry.row.taskId"
              class="batch-file"
            >
              <div class="batch-file-heading">
                <strong>{{ entry.task.name }}</strong><span class="hint"
                  >{{ entry.task.file ? qualities[entry.task.file.quality] : '' }} ·
                  {{ duration(entry.task.duration || 0)
                  }}<template v-if="entry.task.state === 'published'"> · 已加入</template></span
                ><button class="text-button" type="button" @click="emit('preview', entry.task)">
                  解析预览
                </button>
              </div>
              <div class="batch-file-fields">
                <label
                  >歌曲名<input
                    v-model="entry.row.title"
                    :disabled="
                      entry.row.choice.startsWith('track:') || entry.task.state === 'published'
                    "
                    maxlength="255"
                    required
                /></label>
                <label v-if="entry.row.matches.length"
                  >加入方式<BaseSelect
                    v-model="entry.row.choice"
                    :disabled="entry.task.state === 'published'"
                    :label="`${entry.task.name} 的歌曲归属`"
                    :options="batch.options(entry.row)"
                    @update:model-value="batch.choose(entry.task, entry.row)"
                /></label>
                <label v-else>加入方式<span class="batch-static hint">新建歌曲</span></label>
                <label v-if="batch.albums.length > 1"
                  >专辑分组<BaseSelect
                    :model-value="entry.row.albumKey"
                    :disabled="entry.task.state === 'published'"
                    :label="`${entry.task.name} 的专辑分组`"
                    :options="batch.groupOptions"
                    @update:model-value="batch.moveRow(entry.row, $event)"
                /></label>
                <label
                  >歌曲演唱者<input
                    :value="batch.songArtist(entry.row)"
                    @input="updateSongArtist(entry.row, $event)"
                    :disabled="
                      batch.form.applyArtist ||
                      album.applyArtist ||
                      entry.row.choice.startsWith('track:') ||
                      entry.task.state === 'published'
                    "
                    maxlength="255"
                /></label>
                <label
                  >录音版本<input
                    :value="batch.songVersion(entry.row)"
                    @input="entry.row.version = ($event.target as HTMLInputElement).value"
                    :disabled="
                      batch.form.applyVersion ||
                      entry.row.choice.startsWith('track:') ||
                      entry.task.state === 'published'
                    "
                    :placeholder="
                      batch.form.applyVersion ? batch.form.version || '统一留空' : '未标注版本'
                    "
                    maxlength="100"
                /></label>
                <label class="batch-number"
                  >碟号<input
                    v-model.number="entry.row.disc"
                    :disabled="entry.task.state === 'published'"
                    max="999"
                    min="1"
                    type="number"
                /></label>
                <label class="batch-number"
                  >曲序<input
                    v-model.number="entry.row.track"
                    :disabled="entry.task.state === 'published'"
                    max="9999"
                    min="1"
                    type="number"
                /></label>
              </div>
              <p
                v-if="
                  entry.row.matches.some(
                    (match) => entry.row.choice.endsWith(match.id) && match.different_recording,
                  )
                "
                class="task-warning"
              >
                所选歌曲的音频时长与本文件不同，请确认属于同一录音版本。
              </p>
              <p v-else-if="entry.task.file?.preview?.warnings.length" class="hint">
                {{ entry.task.file.preview.warnings.join(' ') }}
              </p>
              <button
                :disabled="batch.busy || entry.row.searching"
                class="text-button"
                type="button"
                @click="batch.searchTracks(entry.task, entry.row)"
              >
                {{ entry.row.searching ? '正在查找…' : '查找已有曲目／录音' }}
              </button>
              <p v-if="entry.task.error" class="error-text">{{ entry.task.error }}</p>
            </article>
          </fieldset>
        </details>
        <div v-if="batch.albums.length > 1 && batch.groupEntries(album).length" class="group-move">
          <BaseSelect
            v-model="album.moveTo"
            :options="[
              { value: '', label: '移入其他分组…' },
              ...batch.groupOptions.filter((option) => option.value !== album.key),
            ]"
            :disabled="batch.busy || batch.done > 0"
            :label="`${batch.groupTitle(album)} 的目标分组`"
          />
          <button
            type="button"
            class="text-button"
            :disabled="batch.busy || batch.done > 0 || !album.moveTo"
            @click="batch.moveGroup(album)"
          >
            移动整组音频
          </button>
        </div>
        <button
          v-if="!batch.groupEntries(album).length"
          type="button"
          class="text-button"
          :disabled="batch.busy"
          @click="batch.removeEmptyGroup(album)"
        >
          移除空分组
        </button>
      </section>
      <div v-if="addingAlbum" class="new-group form-stack">
        <label
          >新专辑分组名称<input
            ref="albumNameInput"
            v-model="albumName"
            maxlength="255"
            :disabled="batch.busy"
            placeholder="填写专辑名称，再确认添加"
        /></label>
        <div class="button-group">
          <button
            type="button"
            class="button small secondary"
            :disabled="batch.busy"
            @click="addingAlbum = false"
          >
            取消添加
          </button>
          <button
            type="button"
            class="button small primary"
            :disabled="batch.busy || !albumName.trim()"
            @click="confirmAlbumGroup"
          >
            确认添加分组
          </button>
        </div>
      </div>
      <button
        v-else
        :disabled="batch.busy"
        class="text-button"
        type="button"
        @click="startAlbumGroup"
      >
        ＋ 添加专辑分组
      </button>
      <p v-if="batch.busy" class="notice" role="status">
        正在加入曲库：{{ batch.done }} / {{ batch.entries.length }} 份音频已完成。
      </p>
    </form>
    <template #footer
      ><button
        type="button"
        :disabled="batch.busy"
        class="button secondary"
        @click="batch.open = false"
      >
        取消</button
      ><button
        :disabled="batch.busy || !batch.valid || !batch.ready.length"
        class="button secondary"
        type="button"
        @click="batch.save"
      >
        保存整理草稿</button
      ><button
        :disabled="batch.busy || !batch.valid || !batch.ready.length"
        class="button primary"
        type="button"
        @click="batch.publish"
      >
        {{ batch.busy ? '正在处理…' : `确认加入 ${batch.ready.length} 份音频` }}
      </button></template
    >
  </BaseDialog>
</template>

<style scoped>
.track-numbering {
  display: grid;
  gap: 8px;
}
.track-numbering-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 10px;
}
.track-numbering-actions > label {
  width: 100px;
  font-size: 12px;
}
.batch-details > summary {
  cursor: pointer;
  color: var(--purple-dark);
  font-size: 12px;
  font-weight: 550;
}
.batch-details[open] > summary {
  margin-bottom: 14px;
}
.musicbrainz-import {
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface, white);
}
.musicbrainz-preview {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}
.musicbrainz-preview > img {
  width: 92px;
  height: 92px;
  flex: 0 0 92px;
  border-radius: 6px;
  object-fit: cover;
  background: var(--soft);
}
.musicbrainz-preview-content {
  min-width: 0;
  flex: 1;
}
.musicbrainz-tracklist {
  max-height: 180px;
  overflow-y: auto;
  padding-left: 22px;
  font-size: 12px;
}
.musicbrainz-tracklist li {
  padding: 2px 0;
}
.public-album-tracklist {
  max-height: 280px;
}
.public-album-description {
  max-height: 120px;
  overflow-y: auto;
}
.musicbrainz-tracklist small {
  display: block;
  color: var(--muted);
}
.group-performer {
  display: grid;
  gap: 8px;
}
.group-move {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.group-move > .select-control {
  flex: 1;
  min-width: min(100%, 180px);
}
.group-track-preview {
  overflow-wrap: anywhere;
}
.new-group {
  padding: 16px;
  border: 1px dashed var(--line);
  border-radius: 10px;
}
.album-confirmation {
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--soft);
}
.album-confirmation-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.album-confirmation-heading > .cover {
  width: 64px;
  flex-shrink: 0;
}
.album-confirmation-heading > div {
  min-width: 0;
}
.album-confirmation-heading h3 {
  overflow-wrap: anywhere;
}
.album-artwork {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.album-artwork .badge {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}
.album-cover-upload {
  position: relative;
  width: fit-content;
  cursor: pointer;
  font-size: 12px;
}
.album-cover-upload input {
  position: absolute;
  width: 100%;
  height: 100%;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.task-warning {
  margin-top: 5px;
  color: #91632b;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.preview-warnings {
  margin: 0;
  padding: 10px 12px 10px 28px;
  border: 1px solid #eddfc8;
  border-radius: 8px;
  background: #fffaf2;
  color: #8d622c;
  font-size: 12px;
  line-height: 1.7;
  list-style: disc;
}
.batch-common {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 0;
  padding: 0;
  border: 0;
}
.batch-common > div {
  display: grid;
  gap: 8px;
}
.batch-files {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  border: 0;
}
.batch-file {
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.batch-file-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 12px;
}
.batch-file-heading > strong {
  min-width: 0;
  flex: 1;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.batch-file-heading > .hint {
  font-size: 11px;
}
.batch-file-fields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 8px;
}
.batch-file-fields > label:first-child,
.batch-file-fields > label:nth-child(2) {
  grid-column: span 2;
}
.batch-file-fields > label {
  min-width: 0;
  font-size: 12px;
}
.batch-static {
  display: flex;
  align-items: center;
  min-height: 40px;
}
@media (max-width: 680px) {
  .batch-common {
    grid-template-columns: 1fr;
  }
  .batch-file-fields {
    grid-template-columns: 1fr 1fr;
  }
  .batch-file-fields > label:nth-child(-n + 3) {
    grid-column: 1 / -1;
  }
  .batch-file {
    padding: 12px;
  }
  .musicbrainz-preview {
    flex-direction: column;
  }
}
</style>
