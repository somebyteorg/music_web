<script lang="ts" setup>
import { useId } from 'vue'
import type { Entity } from '@/types/catalog'
import type { EditorProps } from '@/features/editor/model'
import { useEntityEditor } from '@/features/editor/useEntityEditor'
import { fileUrl } from '@/utils/file'
import BaseDialog from './BaseDialog.vue'
import EntityCover from './EntityCover.vue'
import BaseSelect from './BaseSelect.vue'
import Pagination from './Pagination.vue'

const open = defineModel<boolean>({ default: false })
const props = defineProps<EditorProps>()
const emit = defineEmits<{ saved: [item: Entity] }>()
const formId = `entity-form-${useId()}`
const {
  trackMode,
  libraries,
  albumEntries,
  trackRows,
  assignmentChosen,
  albumSelectionName,
  assignmentReason,
  recordingQuery,
  recordingOptions,
  recordingSongId,
  busy,
  form,
  artists,
  artwork,
  members,
  query,
  options,
  albumOptions,
  albumQuery,
  memberQuery,
  memberOptions,
  uploading,
  images,
  coverInput,
  coverError,
  coverMessage,
  selectCover,
  coverSource,
  title,
  pickAlbum,
  search,
  cover,
  searchRecordings,
  numberTracks,
  save,
} = useEntityEditor(props, open, (item) => emit('saved', item))
</script>
<template>
  <BaseDialog
    v-model="open"
    :busy="busy || uploading"
    :title="title"
    :wide="trackMode || libraryMode"
    ><form :id="formId" class="form-stack" @submit.prevent="save">
      <template v-if="libraryMode"
        ><p class="hint">
          为所选 {{ tracks?.length || 0 }} 首歌曲修改媒体库，专辑关联与音频资源会保留。
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
          <button class="text-button" type="button" @click="libraries.load(true)">重试</button>
        </p>
        <label>修改原因<textarea v-model="assignmentReason" maxlength="1000" rows="2" /></label
      ></template>
      <template v-else-if="trackMode">
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
            /><button class="button secondary" type="button" @click="search('albums')">搜索</button>
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
        <button class="text-button" type="button" @click="numberTracks">
          按当前顺序从 1 编号（每张碟分别编号）
        </button>
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
      <template v-else>
        <label
          >名称
          <input
            v-model="form.name"
            :placeholder="type === 'artists' ? '输入歌手名称' : '输入名称'"
            maxlength="150"
            required
        /></label>
        <div class="cover-editor">
          <button
            :disabled="!coverSource"
            aria-label="预览当前封面"
            class="cover-preview-button"
            type="button"
            @click="
              images.inspect({
                id: form.cover_id || item?.id || '',
                name: '当前封面',
                url: coverSource || undefined,
              })
            "
          >
            <EntityCover
              :item="{
                id: item?.id || '',
                name: form.name,
                cover_id: form.cover_id,
                image_url: item?.image_url,
              }"
              :source="coverSource"
            />
          </button>
          <div>
            <button
              :disabled="busy || uploading"
              class="button secondary"
              type="button"
              @click="coverInput?.click()"
            >
              {{ uploading ? '正在上传…' : '上传封面' }}
            </button>
            <input
              ref="coverInput"
              :disabled="busy || uploading"
              accept="image/jpeg,image/png,image/webp"
              aria-label="选择封面图片"
              class="sr-only"
              tabindex="-1"
              type="file"
              @change="cover"
            />
            <button
              v-if="form.cover_id"
              class="text-button"
              type="button"
              @click="form.cover_id = null"
            >
              移除自定义封面
            </button>
            <p class="hint">支持 JPG、PNG、WebP</p>
            <button
              :disabled="busy || uploading"
              class="text-button"
              type="button"
              @click="images.show"
            >
              从我的图片选择
            </button>
          </div>
        </div>
        <p v-if="coverError" class="notice error" role="alert">{{ coverError }}</p>
        <p v-if="coverMessage" class="hint" role="status">{{ coverMessage }}</p>
        <div v-if="type === 'albums' && artwork.length" class="form-stack">
          <p class="hint">专辑附图 · 移除后保存资料生效。</p>
          <div class="image-grid">
            <article v-for="picture in artwork" :key="picture.file_id" class="image-card">
              <button
                aria-label="预览专辑附图"
                class="image-thumbnail"
                type="button"
                @click="images.inspect({ id: picture.file_id, name: '专辑附图' })"
              >
                <img :src="fileUrl(picture.file_id)" alt="" loading="lazy" />
              </button>
              <span>{{
                { cover: '正面图', back: '封底', disc: '碟面', booklet: '内页', other: '其他图片' }[
                  picture.type
                ]
              }}</span>
              <button
                :disabled="busy || uploading"
                class="text-button"
                type="button"
                @click="artwork = artwork.filter((item) => item.file_id !== picture.file_id)"
              >
                移除附图
              </button>
            </article>
          </div>
        </div>
        <div v-if="images.open" :aria-busy="images.busy" class="form-stack">
          <div class="search-inline">
            <input
              v-model="images.query"
              aria-label="搜索我的图片"
              placeholder="搜索图片文件名"
              @keydown.enter.prevent="images.load(1)"
            />
            <button
              :disabled="images.busy"
              class="button secondary"
              type="button"
              @click="images.load(1)"
            >
              搜索
            </button>
            <button class="text-button" type="button" @click="images.open = false">收起</button>
          </div>
          <p v-if="images.error" class="error-text" role="alert">{{ images.error }}</p>
          <p v-if="!images.busy && !images.items.length" class="hint">
            {{ images.query ? '没有匹配的图片。' : '暂无已上传的图片。' }}
          </p>
          <div class="image-grid">
            <article v-for="file in images.items" :key="file.id" class="image-card">
              <button
                :aria-label="`预览 ${file.file_name}`"
                :disabled="images.busy"
                class="image-thumbnail"
                type="button"
                @click="images.inspect({ id: file.id, name: file.file_name, file })"
              >
                <img :src="fileUrl(file.id)" alt="" loading="lazy" />
              </button>
              <span :title="file.file_name">{{ file.file_name }}</span>
              <button
                :disabled="busy || uploading || images.busy"
                class="text-button"
                type="button"
                @click="selectCover(file)"
              >
                {{ form.cover_id === file.id ? '当前已选' : '用作封面' }}
              </button>
            </article>
          </div>
          <Pagination
            :busy="images.busy"
            :page="images.page"
            :page-size="images.pageSize"
            :total="images.total"
            @change="images.load"
          />
        </div>
        <template v-if="['songs', 'albums'].includes(type)"
          ><label
            >{{ type === 'albums' ? '专辑艺人' : '歌曲演唱者' }}
            <div class="search-inline">
              <input
                v-model="query"
                placeholder="搜索歌手"
                @keydown.enter.prevent="search('artists')"
              /><button class="button secondary" type="button" @click="search('artists')">
                搜索
              </button>
            </div></label
          >
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
            <label>发行日期<input v-model="form.release_date" type="date" /></label
            ><label
              >风格<input v-model="form.genre" maxlength="100" placeholder="比如：流行、爵士"
            /></label></div></template
        ><template v-if="type === 'albums'"
          ><div class="form-grid">
            <label
              >发行年份<input
                v-model.number="form.release_year"
                max="9999"
                min="1000"
                placeholder="仅知道年份时填写"
                type="number" /></label
            ><label
              >发行版本<input
                v-model="form.edition"
                maxlength="100"
                placeholder="首版、重制版等" /></label
            ><label>发行地区<input v-model="form.release_country" maxlength="100" /></label
            ><label>唱片编号<input v-model="form.catalog_number" maxlength="100" /></label
            ><label>厂牌<input v-model="form.label" maxlength="255" /></label
            ><label>MusicBrainz 发行 ID<input v-model="form.musicbrainz_id" maxlength="36" /></label
            ><label
              >碟片总数<input
                v-model.number="form.total_discs"
                max="999"
                min="1"
                type="number" /></label
            ><label
              >曲目总数<input v-model.number="form.total_tracks" max="9999" min="1" type="number"
            /></label></div></template
        ><template v-if="type === 'songs'">
          <label
            >所属媒体库<BaseSelect
              v-model="form.library_id"
              :disabled="libraries.busy || busy"
              :options="libraries.options"
              label="歌曲所属媒体库"
          /></label>
          <p v-if="libraries.error" class="error-text">
            {{ libraries.error }}
            <button class="text-button" type="button" @click="libraries.load(true)">重试</button>
          </p>
          <label
            >收录专辑（可添加多张）
            <div class="search-inline">
              <input
                v-model="albumQuery"
                placeholder="搜索并添加专辑"
                @keydown.enter.prevent="search('albums')"
              /><button class="button secondary" type="button" @click="search('albums')">
                搜索
              </button>
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
                <p class="hint">
                  {{ entry.album.release_year || '' }} {{ entry.album.edition || '' }}
                </p>
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
              ><button
                class="text-button danger"
                type="button"
                @click="albumEntries = albumEntries.filter((row) => row !== entry)"
              >
                移出
              </button>
            </article>
          </div>
          <p class="hint">
            每张专辑分别保存碟号与曲序。移出一张专辑会保留歌曲及其余收录，未关联专辑时作为单曲。
          </p>
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
              /><button class="button secondary" type="button" @click="searchRecordings">
                查找
              </button>
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
            关联录音：{{ recordingQuery }}。专辑归属、音频与歌词分别保留。<button
              class="text-button"
              type="button"
              @click="recordingSongId = ''"
            >
              取消本次关联
            </button>
          </p> </template
        ><template v-if="type === 'playlists'"
          ><label class="check-label"
            ><input v-model="form.is_public" type="checkbox" />公开歌单</label
          ><label
            >歌单协作者
            <div class="search-inline">
              <input
                v-model="memberQuery"
                placeholder="搜索成员"
                @keydown.enter.prevent="search('members')"
              /><button class="button secondary" type="button" @click="search('members')">
                搜索
              </button>
            </div></label
          >
          <div class="chips">
            <button
              v-for="m in members"
              :key="m.id"
              class="chip selected"
              type="button"
              @click="members = members.filter((i) => i.id !== m.id)"
            >
              {{ m.pseudonym || m.username }} ×
            </button>
          </div>
          <div v-if="memberOptions.length" class="picker-results">
            <button
              v-for="m in memberOptions"
              :key="m.id"
              :disabled="members.some((i) => i.id === m.id)"
              type="button"
              @click="
                () => {
                  members.push(m)
                  memberOptions = []
                }
              "
            >
              ＋ {{ m.pseudonym || m.username }}
            </button>
          </div>
          <p class="hint">
            私密歌单仅创建者和协作者可见，协作者可以添加、移除歌曲和调整顺序。
          </p></template
        ><label
          >{{ type === 'playlists' ? '歌单简介' : '简介'
          }}<textarea
            v-model="form.description"
            maxlength="30000"
            placeholder="输入简介（选填）"
            rows="4"
          ></textarea>
        </label>
      </template>
    </form>
    <template #footer
      ><button :disabled="busy || uploading" class="button secondary" @click="open = false">
        取消</button
      ><button
        :disabled="
          busy ||
          uploading ||
          (trackMode && !assignmentChosen) ||
          ((libraryMode || (type === 'songs' && !trackMode)) &&
            (!form.library_id || libraries.busy))
        "
        :form="formId"
        class="button primary"
      >
        {{ busy ? '正在保存…' : '保存' }}
      </button></template
    ></BaseDialog
  >
  <BaseDialog
    v-model="images.previewOpen"
    :busy="images.previewBusy"
    :title="images.preview?.name || '图片预览'"
  >
    <img
      v-if="images.preview"
      :alt="images.preview.name"
      :src="images.preview.url || fileUrl(images.preview.id)"
      class="image-preview"
    />
    <p v-if="images.references.length" class="hint">
      使用位置：{{ images.references.join('、') }}。请先从这些位置移除图片，再删除。
    </p>
    <p v-if="images.previewError" class="error-text" role="alert">{{ images.previewError }}</p>
    <p v-if="images.confirmDelete" class="notice">确认删除这张已上传的图片？</p>
    <template #footer>
      <button
        :disabled="images.previewBusy"
        class="button secondary"
        type="button"
        @click="images.previewOpen = false"
      >
        关闭
      </button>
      <button
        v-if="images.preview?.file"
        :disabled="
          images.previewBusy ||
          !!images.previewError ||
          !!images.references.length ||
          busy ||
          uploading
        "
        class="text-button danger"
        type="button"
        @click="images.confirmDelete ? images.remove() : (images.confirmDelete = true)"
      >
        {{ images.confirmDelete ? '确认删除' : '删除图片' }}
      </button>
      <button
        v-if="images.preview?.file"
        :disabled="images.previewBusy || busy || uploading"
        class="button primary"
        type="button"
        @click="selectCover(images.preview.file)"
      >
        用作封面
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.album-track-rows {
  display: flex;
  flex-direction: column;
}
.album-track-rows article {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 66px 66px 60px;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.album-track-rows article > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.album-track-rows label {
  font-size: var(--font-xs);
}
.album-track-rows input[type='number'] {
  padding-inline: 7px;
}
.album-track-rows .removed > div {
  opacity: 0.5;
}
@media (max-width: 480px) {
  .album-track-rows article {
    grid-template-columns: minmax(0, 1fr) 55px 55px;
    gap: 8px;
  }
  .album-track-rows .check-label {
    grid-column: 1 / -1;
  }
}

.cover-editor {
  display: flex;
  align-items: center;
  gap: 16px;
}
.cover-preview-button {
  width: 72px;
  flex-shrink: 0;
}
.cover-editor .text-button {
  display: block;
  font-size: var(--font-sm);
}
.cover-editor .hint {
  margin-top: 4px;
}
.cover-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.cover-picker > button {
  min-width: 0;
  text-align: left;
}
.cover-picker img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 5px;
  margin-bottom: 5px;
}
.cover-picker span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: var(--font-xs);
}
</style>
