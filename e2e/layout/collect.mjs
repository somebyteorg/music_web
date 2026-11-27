/**
 * 布局快照采集：只取「可见元素 + 整像素几何 + 布局/颜色相关的计算样式」。
 *
 * 跨机器稳定的取舍（为什么这些值不受字体/抗锯齿影响）：
 * - 几何用 getBoundingClientRect()（border box，CSS px），四舍五入到整像素；
 * - 只取布局与颜色属性，不取任何字体度量派生值（text-overflow / scrollHeight / 行数…）；
 * - 颜色统一序列化成 rgb()/rgba()（8bit + 最多 3 位 alpha），规避 color(srgb 0.56…) 这类
 *   6 位小数序列化差异；
 * - class 签名排序去重，并剔除 scope hash / CSS Modules hash 这类自动生成的类名；
 * - 与默认值相同的样式项不落盘：默认值是浏览器初始值常量，不是本机测量值。
 */

export const SNAPSHOT_VERSION = 1

/** 需要采集的计算样式：布局相关 + 颜色相关，逐条对应任务约定。 */
export const STYLE_PROPS = [
  'display',
  'position',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-self',
  'align-content',
  'order',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-auto-flow',
  'grid-auto-columns',
  'grid-auto-rows',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'box-shadow',
]

/** 这些属性无论是否等于初始值都落盘：它们本身就是“读快照时最想知道”的东西。 */
export const ALWAYS_KEPT_STYLE_PROPS = ['display', 'font-size', 'color']

/** 初始值常量：等于初始值即不落盘（值来自 CSS 规范，与本机无关）。 */
export const DEFAULT_STYLE_VALUES = {
  position: 'static',
  'flex-direction': 'row',
  'flex-wrap': 'nowrap',
  'flex-grow': '0',
  'flex-shrink': '1',
  'flex-basis': 'auto',
  'justify-content': 'normal',
  'align-items': 'normal',
  'align-self': 'auto',
  'align-content': 'normal',
  order: '0',
  'row-gap': 'normal',
  'column-gap': 'normal',
  'grid-template-columns': 'none',
  'grid-template-rows': 'none',
  'grid-auto-flow': 'row',
  'grid-auto-columns': 'auto',
  'grid-auto-rows': 'auto',
  'grid-column-start': 'auto',
  'grid-column-end': 'auto',
  'grid-row-start': 'auto',
  'grid-row-end': 'auto',
  'padding-top': '0px',
  'padding-right': '0px',
  'padding-bottom': '0px',
  'padding-left': '0px',
  'margin-top': '0px',
  'margin-right': '0px',
  'margin-bottom': '0px',
  'margin-left': '0px',
  'border-top-width': '0px',
  'border-right-width': '0px',
  'border-bottom-width': '0px',
  'border-left-width': '0px',
  'border-top-left-radius': '0px',
  'border-top-right-radius': '0px',
  'border-bottom-right-radius': '0px',
  'border-bottom-left-radius': '0px',
  'font-weight': '400',
  'line-height': 'normal',
  'letter-spacing': 'normal',
  'background-color': 'rgba(0, 0, 0, 0)',
  'box-shadow': 'none',
}

/** 不参与快照的标签：没有布局语义或内容不是 UI。 */
export const SKIP_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'link',
  'meta',
  'title',
  'br',
  'wbr',
]

/** 单个元素的直接文本最多保留多少字：只用于把同一元素对齐，不参与视觉比较。 */
export const TEXT_PREFIX_LENGTH = 20

/**
 * 在页面里执行：返回按 DOM 顺序排列的可见元素记录。
 * 该函数由 page.evaluate 序列化执行，因此必须自包含（只能读 options）。
 */
export function collectInPage(options) {
  const { styleProps, alwaysKept, defaults, skipTags, textPrefixLength } = options
  const always = new Set(alwaysKept)
  const skip = new Set(skipTags)
  const HASH_LIKE = [/^data-v-[0-9a-z]+$/i, /^css-[0-9a-z]+$/i, /^_[\w-]+_\d+$/, /^[0-9a-f]{6,}$/i]

  const formatRgb = (red, green, blue, alpha) => {
    const channels = [red, green, blue].map((value) =>
      Math.min(255, Math.max(0, Math.round(value))),
    )
    const opacity = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1
    if (opacity >= 1) return `rgb(${channels.join(', ')})`
    return `rgba(${channels.join(', ')}, ${Math.round(opacity * 1000) / 1000})`
  }

  // color(srgb 0.567937 0.567937 0.567937 / 0.5) → rgba(145, 145, 145, 0.5)
  const normalizeColor = (raw) => {
    const text = String(raw || '')
      .trim()
      .toLowerCase()
    if (!text) return ''
    const srgb = text.match(/^color\(srgb ([^)]*)\)$/)
    if (srgb) {
      const [channelText, alphaText] = srgb[1].split('/').map((part) => part.trim())
      const [red, green, blue] = channelText.split(/\s+/).map(Number)
      const alpha = alphaText === undefined ? 1 : Number(alphaText)
      return formatRgb(red * 255, green * 255, blue * 255, alpha)
    }
    const functional = text.match(/^rgba?\(([^)]*)\)$/)
    if (functional) {
      const parts = functional[1].split(/[\s,/]+/).filter(Boolean)
      if (parts.length >= 3) {
        const channels = parts
          .slice(0, 3)
          .map((part) => (part.endsWith('%') ? Number(part.slice(0, -1)) * 2.55 : Number(part)))
        const alphaRaw = parts[3]
        const alpha =
          alphaRaw === undefined
            ? 1
            : alphaRaw.endsWith('%')
              ? Number(alphaRaw.slice(0, -1)) / 100
              : Number(alphaRaw)
        return formatRgb(channels[0], channels[1], channels[2], alpha)
      }
    }
    const hex = text.match(/^#([0-9a-f]{3,8})$/)
    if (hex) {
      const digits = hex[1]
      const step = digits.length <= 4 ? 1 : 2
      const channel = (index) => {
        const part = digits.slice(index * step, index * step + step)
        return parseInt(step === 1 ? part + part : part, 16)
      }
      const alpha =
        digits.length === 4 ? channel(3) / 255 : digits.length === 8 ? channel(3) / 255 : 1
      return formatRgb(channel(0), channel(1), channel(2), alpha)
    }
    return text
  }

  const normalizeValue = (key, raw) => {
    const value = String(raw || '').trim()
    if (!value) return ''
    if (key === 'color' || key.endsWith('-color')) return normalizeColor(value)
    if (value.includes('color(')) {
      return value.replace(/color\(srgb [^)]*\)/g, (hit) => normalizeColor(hit))
    }
    return value
  }

  const classSignature = (element) => {
    const names = [...element.classList]
      .map((name) => name.trim())
      .filter((name) => name && !HASH_LIKE.some((pattern) => pattern.test(name)))
    return [...new Set(names)].sort().join(' ')
  }

  const ownText = (element) => {
    let text = ''
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue || ''
    }
    return text.replace(/\s+/g, ' ').trim().slice(0, textPrefixLength)
  }

  const records = []
  const candidates = [document.body, ...document.body.querySelectorAll('*')]
  for (const element of candidates) {
    const tag = element.tagName.toLowerCase()
    if (skip.has(tag)) continue
    // 图标内部（svg 子树）是图形细节，没有布局语义：只保留 <svg> 自身
    const svgRoot = element.closest('svg')
    if (svgRoot && svgRoot !== element) continue
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    const visible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.visibility !== 'collapse' &&
      Number(style.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0
    if (!visible) continue
    const record = {
      tag,
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    }
    const classes = classSignature(element)
    if (classes) record.classes = classes
    const text = ownText(element)
    if (text) record.text = text
    const color = normalizeColor(style.getPropertyValue('color'))
    const styles = {}
    for (const key of styleProps) {
      const value = normalizeValue(key, style.getPropertyValue(key))
      if (!value) continue
      if (always.has(key)) styles[key] = value
      else if (key === 'background-color') {
        if (value !== defaults[key]) styles[key] = value
      } else if (key.endsWith('-color')) {
        // border-color 初始值是 currentColor：与 color 相同就不落盘
        if (value !== color) styles[key] = value
      } else if (value !== defaults[key]) styles[key] = value
    }
    if (Object.keys(styles).length) record.style = styles
    records.push(record)
  }
  return records
}

/** 取一份快照：页面已导航到目标路由并稳定后调用。 */
export async function collectSnapshot(page, meta) {
  const elements = await page.evaluate(collectInPage, {
    styleProps: STYLE_PROPS,
    alwaysKept: ALWAYS_KEPT_STYLE_PROPS,
    defaults: DEFAULT_STYLE_VALUES,
    skipTags: SKIP_TAGS,
    textPrefixLength: TEXT_PREFIX_LENGTH,
  })
  return { version: SNAPSHOT_VERSION, ...meta, elements }
}
