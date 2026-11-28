<script lang="ts" setup>
import SongList from '@/components/SongList.vue'
import Pagination from '@/components/Pagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Tag from '@/components/ui/Tag.vue'
import TextButton from '@/components/ui/TextButton.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import EntityCover from '@/components/EntityCover.vue'
import { displayName } from '@/utils/format'
import { catalogLabels as labels, pageOptions } from '@/features/catalog/config'
import { useCatalogContext } from './catalogContext'

/**
 * 列表内容区：错误提示、批量操作栏、加载占位、歌曲表 / 封面网格、空态、分页。
 * 只负责「这一份数据怎么显示」，查询条件在 CatalogToolbar，数据与动作都在 CatalogView 的两份控制器里。
 */
const { catalog, actions } = useCatalogContext()
const { type, items, total, busy, loaded, error, page, pageSize, filtered, load, reset } = catalog
const {
  layout,
  selected,
  acting,
  canCreate,
  newItem,
  canMakePrivate,
  privatePlaylist,
  assignLibrary,
} = actions
const { assignAlbum, bulkFavorite, edit, toggle, favorite } = actions
</script>

<template>
  <div v-if="error" class="notice error">
    {{ error }} <TextButton @click="load">重新加载</TextButton>
  </div>
  <div v-if="selected.length" class="selection-bar">
    <span>已选 {{ selected.length }} 首</span>
    <Button variant="secondary" size="sm" :disabled="acting" @click="assignLibrary = true">
      修改媒体库</Button
    ><Button variant="primary" size="sm" :disabled="acting" @click="assignAlbum = true">
      加入专辑</Button
    ><Button variant="secondary" size="sm" :disabled="acting" @click="bulkFavorite(true)">
      收藏</Button
    ><Button variant="secondary" size="sm" :disabled="acting" @click="bulkFavorite(false)">
      取消收藏</Button
    ><TextButton :disabled="acting" @click="selected = []">清空选择</TextButton>
    <span v-if="acting" class="hint" role="status">正在处理…</span>
  </div>
  <Card class="loading-list" v-if="busy && !loaded" aria-busy="true" aria-label="正在加载">
    <div v-for="n in 12" :key="n" class="skeleton"></div>
  </Card>
  <div v-else-if="loaded" :aria-busy="busy">
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
        <span>{{ labels[type] }}</span>
        <span>{{
          type === 'playlists' || type === 'libraries'
            ? '创建者'
            : type === 'artists'
              ? '专辑数'
              : '歌手'
        }}</span>
        <span>歌曲数</span>
        <span>操作</span>
      </div>
      <article v-for="item in items" :key="item.id" class="entity-row">
        <RouterLink
          :class="['entity-main', { 'cover-tile': layout === 'grid' }]"
          :to="`/${type}/${item.id}`"
        >
          <EntityCover :item="item" :round="type === 'artists'" />
          <div>
            <h3 :class="{ 'cover-tile-name': layout === 'grid' }" :title="item.name">
              {{ item.name }}
            </h3>
            <Tag variant="default" v-if="type === 'playlists' && !item.is_public">私密</Tag>
            <p v-if="layout === 'grid'" class="muted cover-tile-meta">
              {{
                type === 'playlists' || type === 'libraries'
                  ? displayName(item.owner || item.creator)
                  : type === 'artists'
                    ? `${item.albums_count || 0} 张专辑`
                    : item.artists?.map((artist) => artist.name).join(' / ') || '未填写歌手'
              }}
            </p>
          </div>
        </RouterLink>
        <span class="entity-secondary">
          {{
            type === 'playlists' || type === 'libraries'
              ? displayName(item.owner || item.creator)
              : type === 'artists'
                ? `${item.albums_count || 0} 张`
                : item.artists?.map((artist) => artist.name).join(' / ') || '未填写'
          }}
        </span>
        <span class="entity-count">
          {{ item.songs_count || 0 }} 首
          <span v-if="type === 'albums' && (item.release_year || item.edition)">
            · {{ item.release_year || '' }} {{ item.edition }}</span
          >
        </span>
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
      />
      <Pagination
        :busy="busy || acting"
        :page="page"
        :page-size="pageSize"
        :total="total"
        @change="page = $event"
      />
    </div>
  </div>
</template>

<style scoped src="./catalogGrid.css"></style>
