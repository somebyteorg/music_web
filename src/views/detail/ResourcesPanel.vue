<script lang="ts" setup>
import EmptyState from '@/components/ui/EmptyState.vue'
import Tag from '@/components/ui/Tag.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { usePlayerStore } from '@/stores/player'
import { useSignStore } from '@/stores/sign'
import { bytes, date, displayName, duration, qualities } from '@/utils/format'
import type { Entity } from '@/types/catalog'
import type { AudioFile } from '@/types/uploads'

const props = defineProps<{
  item: Entity
  acting: boolean
  uploadingCount: number
  unfinishedUploadCount: number
}>()

const emit = defineEmits<{
  setDefault: [file: AudioFile]
  operation: [mode: 'file-move' | 'file-delete', file: AudioFile]
  upload: []
}>()

const player = usePlayerStore()
const sign = useSignStore()
</script>

<template>
  <section class="section">
    <div class="section-heading">
      <p class="hint">试听使用个人设置中的音质，没有对应音质时播放默认音频。</p>
      <Button variant="primary" @click="emit('upload')">＋ 上传音频</Button>
    </div>
    <p v-if="unfinishedUploadCount" class="notice">
      <template v-if="uploadingCount"
        >{{ uploadingCount }} 份音频正在上传或解析，完成后会自动加入本歌曲。</template
      >
      <template v-else>{{ unfinishedUploadCount }} 个上传任务需要处理。</template>
      <TextButton @click="emit('upload')">查看进度</TextButton>
    </p>
    <Card class="resources-panel" v-if="item.files?.length">
      <table class="resource-table">
        <thead>
          <tr>
            <th scope="col">文件</th>
            <th scope="col">音质 / 格式</th>
            <th class="audio-params" scope="col">音频参数</th>
            <th scope="col">大小</th>
            <th scope="col">时长</th>
            <th class="uploader" scope="col">上传者</th>
            <th class="resource-actions-heading" scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="file in item.files"
            :key="file.id"
            :class="{ current: player.file?.id === file.id }"
          >
            <td class="resource-file">
              <div class="resource-name">
                <button
                  v-if="player.supported(file)"
                  :aria-label="`${player.file?.id === file.id && player.playing ? '暂停' : '试听'} ${file.file_name}`"
                  :title="player.file?.id === file.id && player.playing ? '暂停' : '试听'"
                  class="tiny-play"
                  @click="player.play(file, props.item)"
                >
                  <svg aria-hidden="true" class="ui-icon playback-icon" viewBox="0 0 24 24">
                    <path
                      :d="
                        player.file?.id === file.id && player.playing
                          ? 'M6 5h4v14H6zM14 5h4v14h-4z'
                          : 'm8 5 11 7-11 7Z'
                      "
                    />
                  </svg></button
                ><strong :title="file.file_name">{{ file.file_name }}</strong>
              </div>
              <Tag variant="brand" v-if="file.is_default">默认</Tag
              ><span v-if="!player.supported(file)" class="hint unsupported">浏览器不支持试听</span>
            </td>
            <td>
              <span class="quality-label">{{ qualities[file.quality] }}</span><small>{{
                file.codec.toUpperCase()
              }}</small>
            </td>
            <td class="audio-params">
              <span
                >{{ file.sample_rate / 1000 }} kHz<span v-if="file.bit_depth">
                  / {{ file.bit_depth }} bit</span
                ></span
              ><small>{{ file.bitrate }} kbps</small>
            </td>
            <td class="numeric">{{ bytes(file.file_size) }}</td>
            <td class="numeric">{{ duration(file.duration) }}</td>
            <td class="uploader">
              <span>{{ displayName(file.uploader) }}</span><small>{{
                date(file.updated_at)
              }}</small>
            </td>
            <td>
              <div class="resource-actions">
                <TextButton
                  v-if="!file.is_default"
                  :disabled="acting"
                  class="default-action"
                  @click="emit('setDefault', file)"
                >
                  设为默认
                </TextButton>
                <details class="action-menu">
                  <summary :aria-label="`${file.file_name} 的更多操作`">⋯</summary>
                  <div
                    class="action-menu-items"
                    @click="
                      ($event.currentTarget as HTMLElement).parentElement?.removeAttribute('open')
                    "
                  >
                    <button
                      v-if="!file.is_default"
                      :disabled="acting"
                      class="mobile-default"
                      @click="emit('setDefault', file)"
                    >
                      设为默认</button
                    ><button @click="emit('operation', 'file-move', file)">移动到其他歌曲</button
                    ><button
                      v-if="file.user_id === sign.user?.id || sign.canModerate"
                      class="danger"
                      @click="emit('operation', 'file-delete', file)"
                    >
                      删除资源
                    </button>
                  </div>
                </details>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>
    <EmptyState v-else panel symbol="≋" as="h3" title="暂无音频">
      上传音频后即可试听。
      <template #actions>
        <Button variant="primary" @click="emit('upload')">＋ 上传音频</Button>
      </template>
    </EmptyState>
  </section>
</template>

<style scoped src="./resources.css"></style>
