<script lang="ts" setup>
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
      <RouterLink v-if="type === 'songs'" class="button secondary" to="/uploads"
        >↑ 上传音频</RouterLink
      ><button v-if="canCreate" class="button primary" @click="newItem">
        ＋ 新建{{ labels[type] }}
      </button>
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
      /><button v-if="q" aria-label="清空搜索" class="icon-button" @click="q = ''">×</button>
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
    <button v-if="filtered" class="text-button" @click="reset">重置</button>
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
    {{ error }} <button class="text-button" @click="load">重新加载</button>
  </div>
  <div v-if="selected.length" class="selection-bar">
    <span>已选 {{ selected.length }} 首</span
    ><button :disabled="acting" class="button small secondary" @click="assignLibrary = true">
      修改媒体库</button
    ><button :disabled="acting" class="button small primary" @click="assignAlbum = true">
      加入专辑</button
    ><button :disabled="acting" class="button small secondary" @click="bulkFavorite(true)">
      收藏</button
    ><button :disabled="acting" class="button small secondary" @click="bulkFavorite(false)">
      取消收藏</button
    ><button :disabled="acting" class="text-button" @click="selected = []">清空选择</button
    ><span v-if="acting" class="hint" role="status">正在处理…</span>
  </div>
  <div v-if="busy && !loaded" aria-busy="true" aria-label="正在加载" class="panel loading-list">
    <div v-for="n in 12" :key="n" class="skeleton"></div>
  </div>
  <div v-else :aria-busy="busy">
    <div v-if="items.length && type === 'songs'" class="panel">
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
    </div>
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
            <span v-if="type === 'playlists' && !item.is_public" class="badge quiet">私密</span>
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
          <button
            v-if="canMakePrivate(item)"
            :disabled="acting"
            class="text-button"
            @click="privatePlaylist = item"
          >
            设为私密
          </button>
        </div>
      </article>
    </div>
    <div v-else-if="!error && !busy" class="empty panel">
      <span class="empty-symbol">⌕</span>
      <h2>{{ filtered ? '没有符合条件的结果' : `暂无${labels[type]}` }}</h2>
      <p>
        {{
          filtered
            ? '尝试其他关键词或重置筛选。'
            : canCreate
              ? `新建${labels[type]}，开始整理曲库。`
              : '请联系管理员创建媒体库。'
        }}
      </p>
      <button v-if="filtered" class="button secondary" @click="reset">重置筛选</button
      ><button v-else-if="canCreate" class="button primary" @click="newItem">
        ＋ 新建{{ labels[type] }}
      </button>
    </div>
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
      <button :disabled="acting" class="button secondary" @click="privatePlaylist = undefined">
        取消
      </button>
      <button :disabled="acting" class="button primary" @click="makePrivate">
        {{ acting ? '正在处理…' : '确认设为私密' }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.catalog-intro {
  margin-top: 10px;
  color: var(--muted);
  font-size: var(--font-base);
}
.view-toggle {
  display: flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: #fff;
}
.view-toggle button {
  min-height: 32px;
  padding: 6px 11px;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--muted);
}
.view-toggle .active {
  color: var(--purple-dark);
  background: var(--lilac);
}
.selection-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: var(--lilac);
  border: 1px solid #d9cbed;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
}
.loading-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--space-3);
}
.loading-list .skeleton {
  height: 32px;
}
.catalog.list {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius);
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
  color: var(--muted);
  background: var(--soft);
  font-size: var(--font-sm);
  border-radius: var(--radius) var(--radius) 0 0;
}
.list .entity-row {
  min-height: 74px;
  border-top: 1px solid var(--line);
}
.list .entity-row:hover {
  background: #faf9fd;
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
  font-size: var(--font-md);
}
.entity-main:hover h3 {
  color: var(--purple);
}
.entity-main .badge {
  margin-top: 3px;
}
.entity-secondary,
.entity-count {
  color: var(--muted);
  font-size: var(--font-sm);
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
  box-shadow: 0 5px 16px #29203509;
  transition:
    transform 0.25s,
    box-shadow 0.25s;
}
.grid .entity-main:hover > .cover {
  transform: translateY(-4px);
  box-shadow: 0 10px 24px #29203516;
}
.grid .entity-main > .cover.round {
  width: 85%;
  margin: 8px auto 20px;
}
.grid .entity-main p {
  font-size: var(--font-sm);
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
  gap: var(--space-2);
  font-size: var(--font-base);
}
.grid .entity-actions {
  float: right;
  margin-top: 8px;
}
.catalog-pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: 20px;
  margin-top: 24px;
  border-top: 1px solid var(--line);
}
.catalog-pagination :deep(.pagination) {
  flex: 1;
  margin: 0;
}
@media (max-width: 640px) {
  .catalog {
    --entity-action-width: 34px;
  }
  .catalog.playlists {
    --entity-action-width: 64px;
  }
  .entity-label,
  .list .entity-row {
    grid-template-columns: minmax(120px, 1fr) 65px var(--entity-action-width);
    gap: var(--space-2);
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
