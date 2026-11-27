import { inject, type InjectionKey } from 'vue'
import type { useCatalog } from '@/features/catalog/useCatalog'
import type { useCatalogActions } from '@/features/catalog/useCatalogActions'

/**
 * 列表页把两个「控制器」原样交给子组件，而不是拆成十几个 props：
 * 子组件只读状态、只调动作，状态的唯一归属仍是 CatalogView。
 * 与 detail/detailContext.ts 同一套做法。
 */
export interface CatalogContext {
  catalog: ReturnType<typeof useCatalog>
  actions: ReturnType<typeof useCatalogActions>
}

export const catalogContextKey: InjectionKey<CatalogContext> = Symbol('catalogContext')

export function useCatalogContext() {
  const context = inject(catalogContextKey)
  if (!context) throw new Error('列表子组件缺少上下文（catalogContextKey）')
  return context
}
