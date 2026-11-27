import { inject } from 'vue'
import type { InjectionKey } from 'vue'
import type { useAppShell } from './useAppShell'

/**
 * App 骨架的状态中枢：App.vue 调用一次 useAppShell，再把整份控制器交给侧栏 / 顶栏 / 启动门。
 * 子组件只读状态、触发动作，状态的唯一归属仍是 App.vue（与 detailContext 同一套做法）。
 */
export type AppShellContext = ReturnType<typeof useAppShell>

export const appShellKey: InjectionKey<AppShellContext> = Symbol('appShell')

/** 取骨架上下文；只有 App.vue 的 provide 之下的组件才能用。 */
export function useAppShellContext(): AppShellContext {
  const context = inject(appShellKey)
  if (!context) throw new Error('useAppShellContext 必须在 App.vue 的 appShellKey 之下使用')
  return context
}

/** 顶栏向骨架回填的唯一能力：Esc 收起抽屉后把焦点交还汉堡按钮。 */
export interface AppTopbarExpose {
  focusMenuButton: () => void
}
