<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import ButtonGroup from '@/components/ui/ButtonGroup.vue'
import EditorDialog from '@/components/EditorDialog.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import { provide } from 'vue'
import { useCatalog } from '@/features/catalog/useCatalog'
import { useCatalogActions } from '@/features/catalog/useCatalogActions'
import {
  catalogIntroductions as introductions,
  catalogLabels as labels,
} from '@/features/catalog/config'
import CatalogToolbar from './catalog/CatalogToolbar.vue'
import CatalogGrid from './catalog/CatalogGrid.vue'
import { catalogContextKey } from './catalog/catalogContext'

/**
 * 列表页：只做组合——标题、工具栏、内容区、常驻对话框。
 * 两个控制器（查询与动作）在这里创建，原样 provide 给子组件，状态唯一归属仍是本视图。
 */
const catalog = useCatalog()
const { type, total, loaded } = catalog
const actions = useCatalogActions(catalog)
const {
  canCreate,
  newItem,
  create,
  editing,
  privatePlaylist,
  makePrivate,
  assignLibrary,
  assignAlbum,
  selectedSongs,
  acting,
  saved,
} = actions
provide(catalogContextKey, { catalog, actions })
</script>

<template>
  <div class="page-heading">
    <div>
      <div class="heading-title">
        <h1>{{ labels[type] }}</h1>
        <span v-if="loaded" class="muted"
          >{{ total.toLocaleString() }}
          {{
            type === 'songs' ? '首' : type === 'artists' ? '位' : type === 'libraries' ? '个' : '张'
          }}</span
        >
      </div>
      <p class="catalog-intro">{{ introductions[type] }}</p>
    </div>
    <ButtonGroup>
      <Button v-if="type === 'songs'" to="/uploads" variant="secondary">↑ 上传音频</Button
      ><Button variant="primary" v-if="canCreate" @click="newItem">
        ＋ 新建{{ labels[type] }}
      </Button>
    </ButtonGroup>
  </div>
  <CatalogToolbar />
  <CatalogGrid />
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
@layer components {
  .catalog-intro {
    margin-top: 10px;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
