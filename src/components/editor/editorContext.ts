import { inject, type InjectionKey } from 'vue'
import type { EditorProps } from '@/features/editor/model'
import type { useEntityEditor } from '@/features/editor/useEntityEditor'

/**
 * 编辑弹窗把 useEntityEditor 返回的控制器原样交给子组件：
 * 子组件只读字段/列表状态并触发动作，表单状态与提交的唯一归属仍是 EditorDialog。
 */
export interface EditorContext {
  editor: ReturnType<typeof useEntityEditor>
  /** 弹窗自身的 props：type / item / album / tracks / libraryMode */
  props: EditorProps
}

export const editorContextKey: InjectionKey<EditorContext> = Symbol('editorContext')

export function useEditorContext() {
  const context = inject(editorContextKey)
  if (!context) throw new Error('编辑弹窗子组件缺少上下文（editorContextKey）')
  return context
}
