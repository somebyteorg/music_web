<script lang="ts" setup>
import { computed, ref } from 'vue'
import EntityCover from '@/components/EntityCover.vue'
import { usePlayerStore } from '@/stores/player'
import { useQueueStore } from '@/stores/queue'
import { useSignStore } from '@/stores/sign'
import { displayName } from '@/utils/format'
import type { CatalogType, Entity } from '@/types/catalog'

const props = defineProps<{
  item: Entity
  type: CatalogType
  label: string
  canEdit: boolean
  hasSongs: boolean
  playingAll: boolean
  acting: boolean
}>()

const emit = defineEmits<{
  favorite: []
  edit: []
  playAll: []
  metadata: []
  operation: [mode: 'playlist-private' | 'merge' | 'delete']
}>()

const player = usePlayerStore()
const queue = useQueueStore()
const sign = useSignStore()
const descriptionOpen = ref(false)
const playing = computed(() => player.song?.id === props.item.id && player.playing)

function togglePlay() {
  if (queue.isCurrent(props.item.id)) void player.toggle()
  else void player.playList([props.item], 0, '单曲')
}
</script>

<template>
  <section class="detail-hero">
    <EntityCover
      :item="
        type === 'songs' && !item.cover_id && !item.image_url ? item.albums?.[0] || item : item
      "
      :round="type === 'artists'"
    />
    <div class="detail-copy">
      <p class="detail-kind">
        {{ label }}
        <span v-if="type === 'playlists'"> / {{ item.is_public ? '公开歌单' : '私密歌单' }}</span
        ><span v-if="item.todb_id"> / TODB #{{ item.todb_id }}</span>
      </p>
      <h1>{{ item.name }}</h1>
      <div class="detail-meta">
        <template v-if="item.artists?.length"
          ><RouterLink v-for="a in item.artists" :key="a.id" :to="`/artists/${a.id}`">{{
            a.name
          }}</RouterLink></template
        ><span v-else-if="type === 'playlists'">{{ displayName(item.owner) }} 创建的歌单</span
        ><span v-if="item.release_date">{{ item.release_date }}</span
        ><span v-else-if="item.release_year">{{ item.release_year }}</span
        ><span v-if="item.edition">{{ item.edition }}</span
        ><span v-if="item.release_country">{{ item.release_country }}</span
        ><span v-if="item.catalog_number">{{ item.catalog_number }}</span
        ><RouterLink v-if="item.library" :to="`/libraries/${item.library.id}`">{{
          item.library.name
        }}</RouterLink
        ><span v-if="item.is_default" class="badge">默认媒体库</span
        ><span v-if="item.genre">{{ item.genre }}</span
        ><span v-if="item.recording_version" class="badge">{{ item.recording_version }}</span>
      </div>
      <div v-if="item.description" class="description">
        <p :class="{ expanded: descriptionOpen }">{{ item.description }}</p>
        <button
          v-if="item.description.length > 60 || item.description.includes('\n')"
          :aria-expanded="descriptionOpen"
          class="text-button"
          @click="descriptionOpen = !descriptionOpen"
        >
          {{ descriptionOpen ? '收起简介' : '展开简介' }}
        </button>
      </div>
      <div class="button-group">
        <button
          v-if="type === 'songs' && item.files?.length"
          :aria-label="`${playing ? '暂停' : '试听'} ${item.name}`"
          :title="playing ? '暂停' : '试听'"
          class="button primary detail-play"
          @click="togglePlay"
        >
          <svg aria-hidden="true" class="ui-icon playback-icon" viewBox="0 0 24 24">
            <path :d="playing ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'm8 5 11 7-11 7Z'" />
          </svg></button
        ><button
          v-if="type === 'songs'"
          :aria-label="item.is_favorite ? `取消收藏 ${item.name}` : `收藏 ${item.name}`"
          :aria-pressed="!!item.is_favorite"
          :class="['button secondary follow-button', { active: item.is_favorite }]"
          :title="item.is_favorite ? '取消收藏' : '收藏歌曲'"
          @click="emit('favorite')"
        >
          <svg aria-hidden="true" class="ui-icon" viewBox="0 0 24 24">
            <path d="M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1Z" />
          </svg>
          {{ item.is_favorite ? '已收藏' : '收藏' }}</button
        ><button v-if="canEdit" class="button secondary" @click="emit('edit')">✎ 编辑资料</button>
        <button
          v-if="hasSongs"
          :disabled="playingAll"
          class="button secondary"
          @click="emit('playAll')"
        >
          {{ playingAll ? '正在读取…' : '播放全部' }}
        </button>
        <button
          v-if="type === 'playlists' && item.is_public && sign.canModerate"
          :disabled="acting"
          class="button secondary"
          @click="emit('operation', 'playlist-private')"
        >
          设为私密
        </button>
        <details class="action-menu">
          <summary>更多 ⋯</summary>
          <div
            class="action-menu-items"
            @click="($event.currentTarget as HTMLElement).parentElement?.removeAttribute('open')"
          >
            <button
              v-if="['songs', 'albums', 'artists'].includes(type) && sign.todbEnabled"
              @click="emit('metadata')"
            >
              关联 todb 资料</button
            ><button
              v-if="['songs', 'albums', 'artists'].includes(type)"
              @click="emit('operation', 'merge')"
            >
              合并重复资料</button
            ><RouterLink :to="`/history?entity_type=${type}&entity_id=${item.id}`"
              >查看变更记录</RouterLink
            ><button
              v-if="
                (item.user_id === sign.user?.id || sign.canModerate) && canEdit && !item.is_default
              "
              class="danger"
              @click="emit('operation', 'delete')"
            >
              删除{{ label }}
            </button>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.detail-hero {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 32px;
  margin-bottom: 32px;
  border: 1px solid var(--line);
  border-radius: var(--radius-xl);
  background: linear-gradient(125deg, var(--brand-soft), var(--surface-hover) 75%);
}
.detail-hero > .cover {
  width: clamp(160px, 15vw, 220px);
  flex-shrink: 0;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--ink) 9.4%, transparent);
}
.detail-copy {
  min-width: 0;
  flex: 1;
}
.detail-kind {
  margin-bottom: 12px;
  color: var(--brand);
  font-size: var(--font-sm, 12px);
  letter-spacing: 1px;
}
.detail-copy h1 {
  font-size: clamp(28px, 3vw, 42px);
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.detail-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 12px;
  margin: 14px 0 20px;
  color: var(--text-muted);
  font-size: var(--font-base, 13px);
}
.detail-meta a:hover {
  color: var(--brand);
}
.description {
  margin-bottom: 18px;
  max-width: 900px;
}
.description p {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  color: var(--text-muted);
  font-size: var(--font-base, 13px);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.description p.expanded {
  display: block;
}
.detail-play {
  width: 40px;
  padding: 9px;
}
.follow-button.active {
  color: var(--brand-strong);
  border-color: var(--brand-line);
  background: var(--brand-soft);
}
.follow-button.active .ui-icon {
  fill: var(--brand-veil);
}
@media (max-width: 680px) {
  .detail-hero {
    align-items: flex-start;
    gap: 20px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .detail-hero > .cover {
    width: 96px;
  }
  .detail-kind {
    margin-bottom: 8px;
  }
  .detail-copy h1 {
    font-size: 24px;
  }
}
</style>
