import type { ComputedRef, InjectionKey } from 'vue'
import type { useUploadsStore } from '@/stores/uploads'
import type { UploadBatch } from '@/features/uploads/useUploadBatch'
import type { useUploadImages } from '@/features/uploads/useUploadImages'
import type { useUploadPreview } from '@/features/uploads/useUploadPreview'
import type { useUploadSource } from '@/features/uploads/useUploadSource'
import type { usePendingUploads } from '@/features/uploads/usePendingUploads'

/**
 * 上传页把控制器原样交给子组件，而不是拆成十几个 props：
 * 子组件只读状态、触发动作，状态的唯一归属仍是 UploadsView。
 */
export interface UploadsContext {
  /** 上传任务仓库：页头计数、待确认遍历与续用入口读同一份任务表 */
  uploads: ReturnType<typeof useUploadsStore>
  /** 上传须知、拖拽区与文件夹确认的控制器 */
  source: ReturnType<typeof useUploadSource>
  /** 已上传待确认音频的分页读取 */
  pending: ReturnType<typeof usePendingUploads>
  /** 批量整理控制器，同时挂到 UploadBatchDialog 上 */
  batch: UploadBatch
  /** 我的图片与图片预览 */
  images: ReturnType<typeof useUploadImages>
  /** 解析预览、歌曲归属与入库 */
  preview: ReturnType<typeof useUploadPreview>
  /** 页头与解析预览共享的「有事在做」派生状态 */
  busy: ComputedRef<boolean>
}

export const uploadsContextKey: InjectionKey<UploadsContext> = Symbol('uploadsContext')
