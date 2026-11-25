import type { InjectionKey } from 'vue'
import type { UploadBatch } from './useUploadBatch'

/**
 * 批量整理是一个「控制器对象」（含状态与操作方法），由 UploadsView 创建。
 * 通过 provide/inject 共享，而不是当 prop 传下来再改它的字段——
 * 后者会让「谁拥有这份状态」变得含糊，也会被 vue/no-mutating-props 拦下。
 */
export const uploadBatchKey: InjectionKey<UploadBatch> = Symbol('uploadBatch')
