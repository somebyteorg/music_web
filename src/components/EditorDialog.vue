<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import { provide, useId } from 'vue'
import type { Entity } from '@/types/catalog'
import type { EditorProps } from '@/features/editor/model'
import { useEntityEditor } from '@/features/editor/useEntityEditor'
import BaseDialog from './BaseDialog.vue'
import { editorContextKey } from './editor/editorContext'
import EditorAssignment from './editor/EditorAssignment.vue'
import EditorArtwork from './editor/EditorArtwork.vue'
import EditorDescription from './editor/EditorDescription.vue'
import EditorFields from './editor/EditorFields.vue'
import EditorImagePreview from './editor/EditorImagePreview.vue'
import EditorName from './editor/EditorName.vue'
import EditorPlaylist from './editor/EditorPlaylist.vue'
import EditorRecording from './editor/EditorRecording.vue'
import EditorSongAlbums from './editor/EditorSongAlbums.vue'

const open = defineModel<boolean>({ default: false })
const props = defineProps<EditorProps>()
const emit = defineEmits<{ saved: [item: Entity] }>()
const formId = `entity-form-${useId()}`
const editor = useEntityEditor(props, open, (item) => emit('saved', item))
provide(editorContextKey, { editor, props })
const { assignmentChosen, busy, form, libraries, save, title, trackMode, uploading } = editor
</script>

<template>
  <BaseDialog
    v-model="open"
    :busy="busy || uploading"
    :title="title"
    :wide="trackMode || libraryMode"
  >
    <form :id="formId" class="form-stack" @submit.prevent="save">
      <EditorAssignment v-if="libraryMode || trackMode" />
      <template v-else>
        <EditorName />
        <EditorArtwork />
        <EditorFields v-if="['songs', 'albums'].includes(type)" />
        <EditorSongAlbums v-if="type === 'songs'" />
        <EditorRecording v-if="type === 'songs'" />
        <EditorPlaylist v-if="type === 'playlists'" />
        <EditorDescription />
      </template>
    </form>
    <template #footer
      ><Button variant="secondary" :disabled="busy || uploading" @click="open = false"> 取消</Button
      ><Button
        variant="primary"
        :disabled="
          busy ||
          uploading ||
          (trackMode && !assignmentChosen) ||
          ((libraryMode || (type === 'songs' && !trackMode)) &&
            (!form.library_id || libraries.busy))
        "
        :form="formId"
      >
        {{ busy ? '正在保存…' : '保存' }}
      </Button></template
    >
  </BaseDialog>
  <EditorImagePreview />
</template>
