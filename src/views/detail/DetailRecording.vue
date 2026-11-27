<script lang="ts" setup>
import Card from '@/components/ui/Card.vue'
import type { Entity } from '@/types/catalog'

/** 歌曲详情的「关联的录音版本」区块：同一录音的其他版本。 */
defineProps<{ tracks: Entity[] }>()
</script>
<template>
  <section class="section">
    <h2>关联的录音版本</h2>
    <Card class="recording-releases">
      <RouterLink v-for="track in tracks" :key="track.id" :to="`/songs/${track.id}`"
        ><strong>{{ track.name }} {{ track.recording_version }}</strong
        ><span class="hint"
          >{{ track.albums?.map((album) => album.name).join(' / ') || '单曲' }} ·
          {{ track.library?.name }}</span
        ></RouterLink
      >
    </Card>
  </section>
</template>
<style scoped src="./recordingReleases.css"></style>
