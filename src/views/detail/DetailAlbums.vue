<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import Card from '@/components/ui/Card.vue'
import type { AlbumRef } from '@/types/catalog'

/** 歌曲详情的「收录专辑」区块：只读展示加上一个编辑入口。 */
defineProps<{ albums?: AlbumRef[] }>()
const emit = defineEmits<{ edit: [] }>()
</script>
<template>
  <section class="section">
    <div class="section-heading">
      <h2>
        收录专辑 <span class="muted">{{ albums?.length || 0 }}</span>
      </h2>
      <Button variant="secondary" @click="emit('edit')">编辑专辑与媒体库</Button>
    </div>
    <Card class="recording-releases" v-if="albums?.length">
      <RouterLink v-for="album in albums" :key="album.id" :to="`/albums/${album.id}`"
        ><strong>{{ album.name }}</strong
        ><span class="hint"
          >{{ album.release_year || '' }} {{ album.edition || '' }} · 第
          {{ album.pivot?.disc_number }} 碟 · 第 {{ album.pivot?.track_number }} 首</span
        ></RouterLink
      >
    </Card>
    <p v-else class="hint">暂未收录到专辑，可作为单曲保留。</p>
  </section>
</template>
<style scoped src="./recordingReleases.css"></style>
