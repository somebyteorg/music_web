import type { ComputedRef, InjectionKey } from 'vue'
import type { useEntityDetail } from '@/features/catalog/useEntityDetail'
import type { useDetailOperations } from '@/features/catalog/useDetailOperations'

/**
 * 操作对话框用「控制器对象」接线：状态的唯一归属仍是 DetailView。
 * 条目 item 由父级 v-else-if 收窄为非空后以 props 传入。
 */
export interface OperationContext {
  detail: ReturnType<typeof useEntityDetail>
  operations: ReturnType<typeof useDetailOperations>
  acting: ComputedRef<boolean>
}

export const operationContextKey: InjectionKey<OperationContext> = Symbol('operationContext')
