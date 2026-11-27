<script lang="ts" setup>
import IconButton from '@/components/ui/IconButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Tag from '@/components/ui/Tag.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { useCatalog } from '@/features/catalog/useCatalog'
import { useCatalogActions } from '@/features/catalog/useCatalogActions'
import {
  catalogIntroductions as introductions,
  catalogLabels as labels,
  pageOptions,
  qualityOptions,
  sortOptions,
} from '@/features/catalog/config'
import { displayName } from '@/utils/format'
import EntityCover from '@/components/EntityCover.vue'
import SongList from '@/components/SongList.vue'
import Pagination from '@/components/Pagination.vue'
import EditorDialog from '@/components/EditorDialog.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import BaseDialog from '@/components/BaseDialog.vue'

const catalog = useCatalog()
const {
  type,
  items,
  total,
  busy,
  loaded,
  error,
  q,
  page,
  pageSize,
  sort,
  quality,
  library,
  favorites,
  missing,
  mine,
  filtered,
  load,
  reset,
} = catalog
const {
  libraries,
  canCreate,
  assignLibrary,
  assignAlbum,
  selectedSongs,
  create,
  editing,
  privatePlaylist,
  selected,
  acting,
  layout,
  edit,
  newItem,
  canMakePrivate,
  makePrivate,
  toggle,
  bulkFavorite,
  favorite,
  saved,
} = useCatalogActions(catalog)
</script>

<template>
  <div class="page-heading">
    <div>
      <div class="heading-title">
        <h1>{{ labels[type] }}</h1>
        <span class="muted"
          >{{ total.toLocaleString() }}
          {{
            type === 'songs' ? '首' : type === 'artists' ? '位' : type === 'libraries' ? '个' : '张'
          }}</span
        >
      </div>
      <p class="catalog-intro">{{ introductions[type] }}</p>
    </div>
    <div class="button-group">
      <Button v-if="type === 'songs'" to="/uploads" variant="secondary">↑ 上传音频</Button
      ><Button variant="primary" v-if="canCreate" @click="newItem">
        ＋ 新建{{ labels[type] }}
      </Button>
    </div>
  </div>
  <div :aria-label="`筛选${labels[type]}`" class="filter-bar" role="search">
    <div class="search-field">
      <span aria-hidden="true">⌕</span
      ><input
        v-model="q"
        :aria-label="`搜索${labels[type]}名称`"
        :placeholder="`搜索${labels[type]}名称`"
        maxlength="100"
      /><IconButton label="清空搜索" v-if="q" @click="q = ''">×</IconButton>
    </div>
    <BaseSelect
      v-if="['songs', 'albums'].includes(type)"
      v-model="library"
      :disabled="libraries.busy"
      :options="[{ value: '', label: '全部媒体库' }, ...libraries.options]"
      label="按媒体库筛选"
    />
    <BaseSelect
      v-if="type !== 'playlists'"
      v-model="sort"
      :options="sortOptions"
      label="排列方式"
    />
    <BaseSelect
      v-if="type === 'songs'"
      v-model="quality"
      :options="qualityOptions"
      label="音质筛选"
    />
    <button
      v-if="type === 'songs'"
      :aria-pressed="favorites"
      :class="['chip', { selected: favorites }]"
      title="只看已收藏的歌曲"
      @click="favorites = !favorites"
    >
      已收藏
    </button>
    <button
      v-if="type === 'songs'"
      :aria-pressed="missing"
      :class="['chip', { selected: missing }]"
      @click="missing = !missing"
    >
      缺少音频
    </button>
    <button
      v-if="type === 'playlists'"
      :aria-pressed="mine"
      :class="['chip', { selected: mine }]"
      @click="mine = !mine"
    >
      我参与的
    </button>
    <TextButton v-if="filtered" @click="reset">重置</TextButton>
    <span class="filter-count" role="status">{{
      busy ? '正在更新…' : `共 ${total.toLocaleString()} 条`
    }}</span>
    <div v-if="type !== 'songs'" aria-label="显示方式" class="view-toggle">
      <button
        :aria-pressed="layout === 'list'"
        :class="{ active: layout === 'list' }"
        @click="layout = 'list'"
      >
        列表</button
      ><button
        :aria-pressed="layout === 'grid'"
        :class="{ active: layout === 'grid' }"
        @click="layout = 'grid'"
      >
        封面
      </button>
    </div>
  </div>
  <div v-if="error" class="notice error">
    {{ error }} <TextButton @click="load">重新加载</TextButton>
  </div>
  <div v-if="selected.length" class="selection-bar">
    <span>已选 {{ selected.length }} 首</span
    ><Button variant="secondary" size="sm" :disabled="acting" @click="assignLibrary = true">
      修改媒体库</Button
    ><Button variant="primary" size="sm" :disabled="acting" @click="assignAlbum = true">
      加入专辑</Button
    ><Button variant="secondary" size="sm" :disabled="acting" @click="bulkFavorite(true)">
      收藏</Button
    ><Button variant="secondary" size="sm" :disabled="acting" @click="bulkFavorite(false)">
      取消收藏</Button
    ><TextButton :disabled="acting" @click="selected = []">清空选择</TextButton
    ><span v-if="acting" class="hint" role="status">正在处理…</span>
  </div>
  <Card class="loading-list" v-if="busy && !loaded" aria-busy="true" aria-label="正在加载">
    <div v-for="n in 12" :key="n" class="skeleton"></div>
  </Card>
  <div v-else :aria-busy="busy">
    <Card v-if="items.length && type === 'songs'">
      <SongList
        :disabled="acting"
        :items="items"
        :label="'歌曲'"
        :offset="(page - 1) * pageSize"
        :selected="selected"
        editable
        selectable
        @edit="edit"
        @favorite="favorite"
        @select="toggle"
        @select-all="selected = $event ? items.map((item) => item.id) : []"
      />
    </Card>
    <div v-else-if="items.length" :class="['catalog', layout, { playlists: type === 'playlists' }]">
      <div v-if="layout === 'list'" class="entity-label">
        <span>{{ labels[type] }}</span><span>{{
          type === 'playlists' || type === 'libraries'
            ? '创建者'
            : type === 'artists'
              ? '专辑数'
              : '歌手'
        }}</span
        ><span>歌曲数</span><span>操作</span>
      </div>
      <article v-for="item in items" :key="item.id" class="entity-row">
        <RouterLink :to="`/${type}/${item.id}`" class="entity-main"
          ><EntityCover :item="item" :round="type === 'artists'" />
          <div>
            <h3 :title="item.name">{{ item.name }}</h3>
            <Tag variant="default" v-if="type === 'playlists' && !item.is_public">私密</Tag>
            <p v-if="layout === 'grid'" class="muted">
              {{
                type === 'playlists' || type === 'libraries'
                  ? displayName(item.owner || item.creator)
                  : type === 'artists'
                    ? `${item.albums_count || 0} 张专辑`
                    : item.artists?.map((artist) => artist.name).join(' / ') || '未填写歌手'
              }}
            </p>
          </div></RouterLink
        >
        <span class="entity-secondary">{{
          type === 'playlists' || type === 'libraries'
            ? displayName(item.owner || item.creator)
            : type === 'artists'
              ? `${item.albums_count || 0} 张`
              : item.artists?.map((artist) => artist.name).join(' / ') || '未填写'
        }}</span>
        <span class="entity-count"
          >{{ item.songs_count || 0 }} 首<span
            v-if="type === 'albums' && (item.release_year || item.edition)"
          >
            · {{ item.release_year || '' }} {{ item.edition }}</span
          ></span
        >
        <div class="entity-actions">
          <RouterLink :to="`/${type}/${item.id}`" class="text-link">查看</RouterLink>
          <TextButton
            v-if="canMakePrivate(item)"
            :disabled="acting"
            @click="privatePlaylist = item"
          >
            设为私密
          </TextButton>
        </div>
      </article>
    </div>
    <EmptyState
      v-else-if="!error && !busy"
      panel
      symbol="⌕"
      :title="filtered ? '没有符合条件的结果' : `暂无${labels[type]}`"
    >
      {{
        filtered
          ? '尝试其他关键词或重置筛选。'
          : canCreate
            ? `新建${labels[type]}，开始整理曲库。`
            : '请联系管理员创建媒体库。'
      }}
      <template #actions>
        <Button variant="secondary" v-if="filtered" @click="reset">重置筛选</Button
        ><Button variant="primary" v-else-if="canCreate" @click="newItem">
          ＋ 新建{{ labels[type] }}
        </Button>
      </template>
    </EmptyState>
    <div v-if="total" class="catalog-pagination">
      <BaseSelect
        v-model="pageSize"
        :disabled="busy || acting"
        :options="pageOptions"
        :searchable="false"
        label="每页数量"
      /><Pagination
        :busy="busy || acting"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @change="page = $event"
      />
    </div>
  </div>
  <EditorDialog
    v-model="assignLibrary"
    :tracks="selectedSongs"
    library-mode
    type="songs"
    @saved="saved"
  />
  <EditorDialog v-model="assignAlbum" :tracks="selectedSongs" type="songs" @saved="saved" />
  <EditorDialog v-model="create" :item="editing" :type="type" @saved="saved" />
  <BaseDialog
    :busy="acting"
    :model-value="!!privatePlaylist"
    title="设为私密歌单"
    @update:model-value="
      (value) => {
        if (!value) privatePlaylist = undefined
      }
    "
  >
    <p>将「{{ privatePlaylist?.name }}」设为创建者的私密歌单，之后仅创建者和协作者可见。</p>
    <template #footer>
      <Button variant="secondary" :disabled="acting" @click="privatePlaylist = undefined">
        取消
      </Button>
      <Button variant="primary" :disabled="acting" @click="makePrivate">
        {{ acting ? '正在处理…' : '确认设为私密' }}
      </Button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.catalog-intro {
  margin-top: 10px;
  color: var(--text-muted);
  font-size: 13px;
}
.view-toggle {
  display: flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}
.view-toggle button {
  min-height: 32px;
  padding: 6px 11px;
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-muted);
}
.view-toggle .active {
  color: var(--brand-strong);
  background: var(--brand-soft);
}
.selection-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--brand-soft);
  border: 1px solid var(--brand-line-bar);
  border-radius: 6px;
  font-size: 12px;
}
.loading-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
}
.loading-list .skeleton {
  height: 32px;
}
.catalog.list {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
}
.catalog {
  --entity-action-width: 48px;
}
.catalog.playlists {
  --entity-action-width: 110px;
}
.entity-label,
.list .entity-row {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) minmax(100px, 1fr) 80px var(--entity-action-width);
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
}
.entity-label {
  min-height: 44px;
  color: var(--text-muted);
  background: var(--surface-muted);
  font-size: 12px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}
.list .entity-row {
  min-height: 74px;
  border-top: 1px solid var(--line);
}
.list .entity-row:hover {
  background: var(--surface-hover);
}
.entity-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.entity-main > .cover {
  width: 48px;
  flex-shrink: 0;
}
.entity-main > div {
  min-width: 0;
}
.entity-main h3 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}
.entity-main:hover h3 {
  color: var(--brand);
}
.entity-main .ui-tag {
  margin-top: 3px;
}
.entity-secondary,
.entity-count {
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.catalog.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 30px 24px;
}
.grid .entity-row {
  position: relative;
  min-width: 0;
}
.grid .entity-main {
  display: block;
}
.grid .entity-main > .cover {
  width: 100%;
  margin-bottom: 16px;
  box-shadow: var(--shadow-cover);
  transition:
    transform 0.25s,
    box-shadow 0.25s;
}
.grid .entity-main:hover > .cover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-cover-hover);
}
.grid .entity-main > .cover.round {
  width: 85%;
  margin: 8px auto 20px;
}
.grid .entity-main p {
  font-size: 12px;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grid .entity-secondary {
  display: none;
}
.grid .entity-count {
  display: inline-block;
  margin-top: 8px;
}
.entity-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
}
.grid .entity-actions {
  float: right;
  margin-top: 8px;
}
.catalog-pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 20px;
  margin-top: 24px;
  border-top: 1px solid var(--line);
}
.catalog-pagination :deep(.pagination) {
  flex: 1;
  margin: 0;
}
@media (max-width: 680px) {
  .catalog {
    --entity-action-width: 34px;
  }
  .catalog.playlists {
    --entity-action-width: 64px;
  }
  .entity-label,
  .list .entity-row {
    grid-template-columns: minmax(120px, 1fr) 65px var(--entity-action-width);
    gap: 8px;
    padding-inline: 10px;
  }
  .entity-label > span:nth-child(2),
  .list .entity-secondary {
    display: none;
  }
  .catalog.grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px 18px;
  }
  .catalog-pagination {
    align-items: flex-start;
  }
  .catalog-pagination :deep(.pagination) {
    flex-basis: 100%;
  }
}
</style>
