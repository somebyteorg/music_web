import { computed, readonly, ref, watch } from 'vue'

/**
 * 主题状态：跟随系统 / 浅色 / 深色三态，持久化到 localStorage。
 *
 * - 实际主题只落到 <html data-theme="dark">（浅色直接移除属性），
 *   颜色全部由 src/styles/tokens.css 的 token 决定，组件里不写死颜色；
 * - 首屏由 index.html 的内联脚本先用同一套规则写好 data-theme，避免浅色闪烁；
 * - 这里是单例：App 顶栏按钮和设置页「外观」共享同一份状态。
 */
export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** 持久化键名：index.html 的首屏内联脚本读取同一个键，改动时两处同步。 */
export const THEME_STORAGE_KEY = 'music-theme'

export const themeLabels: Record<ThemePreference, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

/** 顶栏按钮的循环顺序：浅色 → 深色 → 跟随系统 → 浅色。 */
const nextPreference: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

const DARK_SCHEME = '(prefers-color-scheme: dark)'

function normalizePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

function readStoredPreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  try {
    return normalizePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    // 隐私模式禁用存储时按「跟随系统」处理
    return 'system'
  }
}

function systemQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(DARK_SCHEME)
}

const preference = ref<ThemePreference>(readStoredPreference())
const systemPrefersDark = ref(systemQuery()?.matches ?? false)

/** 解析后的实际主题：固定值直接生效，system 跟随并实时监听系统偏好。 */
const resolved = computed<ResolvedTheme>(() =>
  preference.value === 'system' ? (systemPrefersDark.value ? 'dark' : 'light') : preference.value,
)

let started = false
/** index.html 里原有的浅色 theme-color，切回浅色时恢复，避免在这里写死色值。 */
let lightThemeColor: string | null = null

function syncThemeColor(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) return
  lightThemeColor ??= meta.getAttribute('content')
  if (theme !== 'dark') {
    if (lightThemeColor) meta.setAttribute('content', lightThemeColor)
    return
  }
  // 深色取 token 里的页面底色，让浏览器地址栏跟着页面走
  const background = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (background) meta.setAttribute('content', background)
}

function applyTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  // 现有样式只依赖 data-theme，没有基于 <html class> 的选择器，故不额外挂类名
  if (theme === 'dark') root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  syncThemeColor(theme)
}

function persist(value: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
  } catch {
    // 存储不可用时只在本次会话生效
  }
}

/** 把存储里的非法值就地修正为 system，避免脏值一直留在 localStorage 里。 */
function repairStoredPreference() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored !== null && stored !== preference.value) persist(preference.value)
  } catch {
    // 存储不可用时无需修复
  }
}

function onSystemChange(event: MediaQueryListEvent) {
  systemPrefersDark.value = event.matches
}

function start() {
  if (started) return
  started = true
  const query = systemQuery()
  if (query) {
    systemPrefersDark.value = query.matches
    query.addEventListener('change', onSystemChange)
  }
  watch(preference, persist)
  watch(resolved, applyTheme, { immediate: true })
  repairStoredPreference()
  // dev 下样式表由 JS 注入，首帧前可能还读不到 token，补一次 theme-color 同步
  window.requestAnimationFrame?.(() => syncThemeColor(resolved.value))
}

if (typeof window !== 'undefined') start()

export function useTheme() {
  return {
    preference: readonly(preference),
    resolved,
    labels: themeLabels,
    next: computed(() => nextPreference[preference.value]),
    setPreference: (value: ThemePreference) => {
      preference.value = normalizePreference(value)
    },
    cycle: () => {
      preference.value = nextPreference[preference.value]
    },
  }
}
