<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import EntityCover from '@/components/EntityCover.vue'
import type { UploadBatch } from './useUploadBatch'
import type { BatchAlbum } from './batchModel'
import type { UploadTask } from './model'
import UploadBatchAlbumArtwork from './UploadBatchAlbumArtwork.vue'
import UploadBatchTracks from './UploadBatchTracks.vue'
import { useAlbumField } from './batchField'

const props = defineProps<{ batch: UploadBatch; album: BatchAlbum }>()
const selection = useAlbumField(props.batch, props.album, 'selection')
const applyArtist = useAlbumField(props.batch, props.album, 'applyArtist')
const performer = useAlbumField(props.batch, props.album, 'performer')
const name = useAlbumField(props.batch, props.album, 'name')
const artistName = useAlbumField(props.batch, props.album, 'artist_name')
const releaseYear = useAlbumField(props.batch, props.album, 'release_year')
const edition = useAlbumField(props.batch, props.album, 'edition')
const releaseCountry = useAlbumField(props.batch, props.album, 'release_country')
const catalogNumber = useAlbumField(props.batch, props.album, 'catalog_number')
const label = useAlbumField(props.batch, props.album, 'label')
const totalDiscs = useAlbumField(props.batch, props.album, 'total_discs')
const totalTracks = useAlbumField(props.batch, props.album, 'total_tracks')
const musicbrainzId = useAlbumField(props.batch, props.album, 'musicbrainz_id')
const emit = defineEmits<{
  preview: [task: UploadTask]
  'browse-images': [album: BatchAlbum]
  inspect: [picture: ReturnType<UploadBatch['pictures']>[number], album: BatchAlbum]
}>()
</script>
<template>
  <section class="album-confirmation">
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
        v-model="selection"
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
        ><input v-model="applyArtist" type="checkbox" :disabled="batch.busy" />统一本组演唱者</label
      >
      <input
        v-model="performer"
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
    <ul v-if="batch.selectedAlbum(album)?.conflicts.length" class="preview-warnings">
      <li v-for="conflict in batch.selectedAlbum(album)?.conflicts" :key="conflict">
        {{ conflict }}
      </li>
    </ul>
    <div v-if="!album.selection || album.selection === 'new'" class="form-stack">
      <div class="form-grid">
        <label
          >专辑名称<input
            v-model="name"
            :disabled="batch.busy"
            maxlength="255"
            placeholder="专辑名称" /></label
        ><label
          >专辑艺人<input
            v-model="artistName"
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
                v-model.number="releaseYear"
                max="9999"
                min="1000"
                placeholder="未知可留空"
                type="number" /></label
            ><label
              >发行版本<input
                v-model="edition"
                maxlength="100"
                placeholder="如：首版、重制版、豪华版" /></label
            ><label>发行地区<input v-model="releaseCountry" maxlength="100" /></label
            ><label>唱片编号<input v-model="catalogNumber" maxlength="100" /></label
            ><label>厂牌<input v-model="label" maxlength="255" /></label>
          </div>
          <div class="form-grid">
            <label
              >碟片总数<input
                v-model.number="totalDiscs"
                max="999"
                min="1"
                placeholder="未知可留空"
                type="number" /></label
            ><label
              >曲目总数<input
                v-model.number="totalTracks"
                max="9999"
                min="1"
                placeholder="整张专辑的总曲目数"
                type="number" /></label
            ><label
              >MusicBrainz 发行 ID<input
                v-model="musicbrainzId"
                maxlength="36"
                placeholder="未知可留空"
            /></label>
          </div>
          <Button
            :disabled="batch.busy || album.loading || !album.name.trim()"
            variant="secondary"
            size="sm"
            type="button"
            @click="batch.searchAlbums(album)"
          >
            重新查找已有专辑
          </Button>
        </div>
      </details>
    </div>
    <UploadBatchAlbumArtwork
      :album="album"
      :batch="batch"
      @browse-images="emit('browse-images', $event)"
      @inspect="(picture, target) => emit('inspect', picture, target)"
    />
    <UploadBatchTracks :album="album" :batch="batch" @preview="emit('preview', $event)" />
  </section>
</template>
<style scoped>
@layer components {
  .album-confirmation {
    padding: 18px;
    border: 1px solid var(--line);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--surface-muted);
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
  .batch-details > summary {
    cursor: pointer;
    color: var(--brand-strong);
    font-size: 12px;
    font-weight: 550;
  }
  .batch-details[open] > summary {
    margin-bottom: 14px;
  }
  .group-performer {
    display: grid;
    gap: 8px;
  }
  .preview-warnings {
    margin: 0;
    padding: 10px 12px 10px 28px;
    border: 1px solid var(--warning-line);
    border-radius: 8px;
    background: var(--warning-veil);
    color: var(--warning-note);
    font-size: 12px;
    line-height: 1.7;
    list-style: disc;
  }
}
</style>
