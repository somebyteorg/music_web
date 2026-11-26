import type { ComputedRef, InjectionKey } from 'vue'
import type { useEntityDetail } from '@/features/catalog/useEntityDetail'
import type { useDetailOperations } from '@/features/catalog/useDetailOperations'
import type { useSongUploads } from '@/features/catalog/useSongUploads'

/**
 * 详情页把两个「控制器」原样交给子组件，而不是拆成十几个 props：
 * 子组件只读/触发动作，状态的唯一归属仍是 DetailView。
 */
export interface TracksContext {
  detail: ReturnType<typeof useEntityDetail>
  operations: ReturnType<typeof useDetailOperations>
  queueLabel: string
  /** 父组件级派生状态：是否正在执行操作 */
  acting: ComputedRef<boolean>
}

export interface UploadContext {
  detail: ReturnType<typeof useEntityDetail>
  uploads: ReturnType<typeof useSongUploads>
  acting: ComputedRef<boolean>
}

export const tracksContextKey: InjectionKey<TracksContext> = Symbol('tracksContext')
export const uploadContextKey: InjectionKey<UploadContext> = Symbol('uploadContext')
