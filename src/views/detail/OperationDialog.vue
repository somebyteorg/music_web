<script lang="ts" setup>
import BaseDialog from '@/components/BaseDialog.vue'
import Button from '@/components/ui/Button.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { inject } from 'vue'
import type { Entity } from '@/types/catalog'
import { catalogLabels as labels } from '@/features/catalog/config'
import { operationContextKey } from './operationContext'

/**
 * 详情页的操作对话框（删除 / 合并 / 移动 / 添加曲目）。
 * 表单状态全部来自 useDetailOperations 控制器，这里只渲染与触发。
 */
defineProps<{ item: Entity }>()

const context = inject(operationContextKey)
if (!context) throw new Error('操作对话框缺少上下文（operationContextKey）')
const { acting } = context
const { type, total } = context.detail
const {
  operation,
  reason,
  targetQuery,
  targets,
  target,
  selectedFile,
  trackDraft,
  movingEntry,
  movePosition,
  searchTargets,
  apply,
  reorder,
} = context.operations
</script>
<template>
  <BaseDialog
    :busy="acting"
    :model-value="!!operation"
    :title="
      operation === 'merge'
        ? '合并重复资料'
        : operation === 'tracks'
          ? '添加歌曲'
          : operation === 'playlist-move'
            ? '调整曲序'
            : operation === 'playlist-private'
              ? '设为私密歌单'
              : operation === 'file-move'
                ? '移动音频'
                : operation === 'file-delete'
                  ? '删除资源'
                  : `删除${labels[type]}`
    "
    :wide="operation === 'tracks'"
    @update:model-value="
      (v) => {
        if (!v) operation = ''
      }
    "
    ><div class="form-stack">
      <p v-if="operation === 'playlist-private'">
        将「{{ item.name }}」设为创建者的私密歌单，之后仅创建者和协作者可见。
      </p>
      <p v-if="operation === 'delete'" class="hint">
        {{
          type === 'playlists'
            ? '删除后歌单将不可见，不提供曲目恢复。'
            : '删除后可从操作记录中恢复。请先移出关联的歌曲或音频。'
        }}
      </p>
      <p v-if="operation === 'file-delete'" class="hint">
        {{ selectedFile?.file_name }}<br />确认删除这份资源？原文件会保留，可从操作记录中恢复。
      </p>
      <p v-if="operation === 'merge'" class="hint">
        将「{{
          item.name
        }}」的音频和关联资料合并到所选条目，随后删除当前条目。请确认歌手和录音版本一致。
      </p>
      <template v-if="['merge', 'file-move', 'tracks'].includes(operation)"
        ><label
          >{{ operation === 'merge' ? '选择合并目标' : '搜索歌曲' }}
          <div class="search-inline">
            <input
              v-model="targetQuery"
              placeholder="输入名称搜索"
              @keydown.enter.prevent="searchTargets"
            /><Button variant="secondary" :disabled="acting" @click="searchTargets"> 搜索 </Button>
          </div></label
        >
        <div class="picker-results">
          <button
            v-for="t in targets"
            :key="t.id"
            :class="{ selected: target?.id === t.id }"
            :disabled="operation === 'tracks' && trackDraft.some((s) => s.id === t.id)"
            @click="operation === 'tracks' ? trackDraft.push(t) : (target = t)"
          >
            <span>{{ t.name }}</span><small>{{
              t.artists?.map((a) => a.name).join(' / ') || t.recording_version || ''
            }}</small
            ><span v-if="target?.id === t.id">✓</span>
          </button>
        </div>
        <p v-if="target" class="notice">
          已选择：{{ target.name }}
          <span v-if="target.recording_version">({{ target.recording_version }})</span>
        </p></template
      ><label v-if="['merge', 'delete', 'file-delete'].includes(operation)"
        >写下原因<textarea
          v-model="reason"
          maxlength="1000"
          placeholder="请说明操作原因。"
          rows="3"
        ></textarea>
      </label>
      <label v-if="operation === 'playlist-move'">
        将「{{ movingEntry?.name }}」移到第几首
        <input v-model.number="movePosition" :max="total" min="1" step="1" type="number" />
        <span class="hint">共 {{ total }} 首，可直接移到其他页面的位置。</span>
      </label>
      <div v-if="operation === 'tracks'" class="track-editor">
        <p class="hint">已选 {{ trackDraft.length }} 首 · 将按此顺序添加到歌单末尾。</p>
        <article v-for="(s, index) in trackDraft" :key="s.id">
          <span class="muted">{{ index + 1 }}</span><strong>{{ s.name }}</strong
          ><IconButton
            :label="`上移 ${s.name}`"
            :disabled="index === 0"
            @click="reorder(index, -1)"
          >
            ↑</IconButton
          ><IconButton
            :label="`下移 ${s.name}`"
            :disabled="index === trackDraft.length - 1"
            @click="reorder(index, 1)"
          >
            ↓</IconButton
          ><IconButton
            :label="`移除 ${s.name}`"
            class="danger"
            @click="trackDraft.splice(index, 1)"
          >
            ×
          </IconButton>
        </article>
      </div>
    </div>
    <template #footer
      ><Button variant="secondary" :disabled="acting" @click="operation = ''">取消</Button
      ><Button
        variant="primary"
        :disabled="
          acting ||
          ((operation === 'merge' || operation === 'file-move') && !target) ||
          (operation === 'merge' && !reason.trim()) ||
          (operation === 'tracks' && !trackDraft.length) ||
          (operation === 'playlist-move' &&
            (!Number.isInteger(movePosition) || movePosition < 1 || movePosition > total))
        "
        @click="apply"
      >
        {{
          acting
            ? '正在处理…'
            : operation === 'tracks'
              ? '添加到歌单'
              : operation === 'merge'
                ? '确认合并'
                : operation === 'playlist-private'
                  ? '确认设为私密'
                  : operation === 'file-move' || operation === 'playlist-move'
                    ? '确认移动'
                    : '确认删除'
        }}
      </Button></template
    ></BaseDialog
  >
</template>
<style scoped src="./operationDialog.css"></style>
