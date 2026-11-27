<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { computed, inject } from 'vue'
import BaseDialog from '@/components/BaseDialog.vue'
import { useAction } from '@/composables/useFeedback'
import { ACTIVE_UPLOAD_STATES, TRANSMIT_STATES } from '@/features/uploads/model'
import { useSignStore } from '@/stores/sign'
import { useUploadsStore } from '@/stores/uploads'
import type { Entity } from '@/types/catalog'
import { uploadContextKey } from './detailContext'

const context = inject(uploadContextKey)
if (!context) throw new Error('上传弹窗缺少上下文（uploadContextKey）')

const { run } = useAction()
const uploads = useUploadsStore()
const sign = useSignStore()
const item = computed(() => context.detail.item.value as Entity)
const type = context.detail.type
const acting = context.acting
const {
  uploadOpen,
  uploadAccepted,
  addingFiles,
  hasNotice,
  audioAccept,
  songUploads,
  uploadStates,
  audioInput,
  chooseAudio,
  acceptUploadNotice,
} = context.uploads
</script>

<template>
  <BaseDialog
    v-if="type === 'songs'"
    v-model="uploadOpen"
    :busy="addingFiles"
    :title="`为「${item.name}」上传音频`"
  >
    <div class="form-stack">
      <p class="notice">
        上传完成后直接加入这首歌曲。请确认歌手和录音版本一致。<span v-if="item.recording_version"
          >当前版本：{{ item.recording_version }}</span
        >
      </p>
      <template v-if="!hasNotice">
        <h3>上传须知</h3>
        <p class="preline hint">{{ sign.config?.notice.text }}</p>
        <label class="check-label"
          ><input v-model="uploadAccepted" type="checkbox" />我已阅读并同意上传须知</label
        >
        <Button variant="primary" :disabled="!uploadAccepted || acting" @click="acceptUploadNotice">
          确认须知
        </Button>
      </template>
      <input
        ref="audioInput"
        :accept="audioAccept"
        hidden
        multiple
        type="file"
        @change="chooseAudio"
      />
      <Button variant="primary" :disabled="!hasNotice || addingFiles" @click="audioInput?.click()">
        {{ addingFiles ? '正在读取文件…' : '选择音频文件' }}
      </Button>
      <div v-if="songUploads.length" class="song-upload-list">
        <article v-for="task in songUploads" :key="task.id">
          <strong>{{ task.name }}</strong>
          <span class="hint"
            >{{ uploadStates[task.state]
            }}<template v-if="task.state === 'uploading'">
              · {{ task.transfer.progress }}%</template
            ></span
          >
          <progress
            v-if="ACTIVE_UPLOAD_STATES.includes(task.state)"
            :aria-label="`${task.name} 上传进度`"
            :value="
              task.state === 'preparing'
                ? task.transfer.preparationProgress || 0
                : task.transfer.progress
            "
            max="100"
          ></progress>
          <p v-if="task.error" class="error-text">{{ task.error }}</p>
          <p v-if="task.state === 'duplicate'" class="hint">
            相同文件已存在，可使用已有文件或跳过。<RouterLink
              v-if="uploads.duplicateFile(task)?.song_id"
              :to="`/songs/${uploads.duplicateFile(task)?.song_id}`"
              class="text-link"
              >查看已有歌曲</RouterLink
            >
          </p>
          <div class="button-group">
            <TextButton
              v-if="TRANSMIT_STATES.includes(task.state)"
              @click="run(() => uploads.pause(task))"
            >
              暂停
            </TextButton>
            <TextButton
              v-if="['paused', 'failed'].includes(task.state)"
              @click="run(() => uploads.retry(task))"
            >
              重试
            </TextButton>
            <TextButton
              v-if="task.state === 'failed' && !task.transfer.file"
              @click="uploads.restart(task)"
            >
              重新上传
            </TextButton>
            <template v-if="task.state === 'duplicate'"
              ><TextButton
                :disabled="!uploads.duplicateFile(task)"
                @click="run(() => uploads.useDuplicate(task))"
              >
                使用已有文件</TextButton
              ><TextButton @click="uploads.skip(task)">跳过</TextButton></template
            >
          </div>
        </article>
      </div>
      <RouterLink class="text-link" to="/uploads">管理全部上传任务 →</RouterLink>
    </div>
  </BaseDialog>
</template>
