import { inject, type InjectionKey } from 'vue'
import type { useCommunity } from '@/features/community/useCommunity'

/**
 * 社区页把 useCommunity 的控制器原样交给三个栏目的列表组件：
 * 子组件只读状态、只调动作，状态的唯一归属仍是 CommunityView。
 * 与 detail/detailContext.ts、catalog/catalogContext.ts 同一套做法。
 */
export interface CommunityContext {
  community: ReturnType<typeof useCommunity>
}

export const communityContextKey: InjectionKey<CommunityContext> = Symbol('communityContext')

export function useCommunityContext() {
  const context = inject(communityContextKey)
  if (!context) throw new Error('社区列表组件缺少上下文（communityContextKey）')
  return context
}
