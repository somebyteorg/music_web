/**
 * 对比度审计的浏览器侧实现：由 e2e/contrast-audit.mjs 通过 page.evaluate 注入执行。
 *
 * 只做「观察 + 计算」，不做断言，方便单独复用到别的 Playwright 脚本里：
 *   const { collect } = await import('./contrast-page.mjs')
 *   await page.evaluate(collect, { tokens: ['--text', '--bg', ...] })
 *
 * 口径：正文 ≥ 4.5:1，大字（≥18.66px，或 ≥14px 且字重 ≥700）与图标 ≥ 3:1。
 * 背景沿祖先链逐层合成（含 alpha），渐变/图片底无法静态求值，单独标记。
 */
export function collect(options) {
  const surfaces = ['--surface', '--bg', '--surface-muted', '--surface-sunken', '--brand-soft']
  const borders = ['--line', '--line-strong', '--line-faint', '--brand-line', '--brand-line-hover']
  const parse = (raw) => {
    if (!raw) return null
    const value = String(raw).trim().toLowerCase()
    if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    let match = value.match(/^#([0-9a-f]{3,8})$/)
    if (match) {
      const hex = match[1]
      const full = hex.length <= 4 ? hex.replace(/./g, (c) => c + c) : hex
      const num = (i) => parseInt(full.slice(i, i + 2), 16)
      return { r: num(0), g: num(2), b: num(4), a: full.length === 8 ? num(6) / 255 : 1 }
    }
    match = value.match(/^rgba?\(([^)]+)\)$/)
    if (match) {
      const parts = match[1].split(/[\s,/]+/).filter(Boolean)
      const num = (i) => (parts[i] && parts[i].endsWith('%') ? parseFloat(parts[i]) * 2.55 : parseFloat(parts[i]))
      return { r: num(0), g: num(1), b: num(2), a: parts[3] === undefined ? 1 : num(3) }
    }
    match = value.match(/^color\(srgb\s+([^)]+)\)$/)
    if (match) {
      const parts = match[1].split(/[\s/]+/).filter(Boolean)
      const num = (i) =>
        parts[i] && parts[i].endsWith('%') ? parseFloat(parts[i]) * 2.55 : parseFloat(parts[i]) * 255
      return { r: num(0), g: num(1), b: num(2), a: parts[3] === undefined ? 1 : parseFloat(parts[3]) }
    }
    return null
  }
  // 用真实元素解析 token：深色层的 color-mix 也会被算成具体通道值
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const byName = new Map()
  const byColor = new Map()
  for (const name of options.tokens) {
    probe.style.color = 'var(' + name + ')'
    const color = parse(getComputedStyle(probe).color)
    if (!color) continue
    byName.set(name, color)
    const key = [color.r, color.g, color.b].map((n) => Math.round(n)).join(',')
    if (!byColor.has(key)) byColor.set(key, [])
    byColor.get(key).push(name)
  }
  probe.remove()
  const keyOf = (color) => [color.r, color.g, color.b].map((n) => Math.round(n)).join(',')
  const namesOf = (color) => byColor.get(keyOf(color)) || []
  const hexOf = (color) =>
    '#' + [color.r, color.g, color.b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')
  const over = (top, bottom) => {
    const alpha = top.a === undefined ? 1 : top.a
    return {
      r: top.r * alpha + bottom.r * (1 - alpha),
      g: top.g * alpha + bottom.g * (1 - alpha),
      b: top.b * alpha + bottom.b * (1 - alpha),
      a: 1,
    }
  }
  const luminance = (color) => {
    const channel = (raw) => {
      const value = raw / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
  }
  const contrast = (a, b) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }
  const round = (value) => Math.round(value * 100) / 100
  // 渐变的每个色标都算一种可能的底色，最终取最差的一档（hero / 封面都是渐变底）
  const stopsOf = (image) => {
    if (!image || image === 'none' || image.includes('url(')) return null
    const found = image.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)|#[0-9a-f]{3,8}/g)
    if (!found) return null
    const colors = found.map(parse).filter((color) => color && color.a > 0)
    return colors.length ? colors : null
  }
  const backgroundOf = (el) => {
    const paints = []
    let gradient = false
    let image = false
    let opacity = 1
    let node = el
    while (node && node.nodeType === 1) {
      const style = getComputedStyle(node)
      const color = parse(style.backgroundColor)
      if (color && color.a > 0) paints.push([color])
      const stops = stopsOf(style.backgroundImage)
      if (stops) {
        paints.push(stops)
        gradient = true
      } else if (style.backgroundImage && style.backgroundImage.includes('url(')) {
        image = true
      }
      opacity *= Number(style.opacity) || 1
      if (color && color.a >= 0.999) break
      node = node.parentElement
    }
    let candidates = [{ r: 255, g: 255, b: 255, a: 1 }]
    for (let i = paints.length - 1; i >= 0; i -= 1) {
      const next = []
      for (const base of candidates) for (const paint of paints[i]) next.push(over(paint, base))
      candidates = next.slice(0, 12)
    }
    return { candidates, gradient, image, opacity }
  }
  const selectorOf = (el) => {
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && parts.length < 4) {
      const classes = Array.from(node.classList).slice(0, 2)
      parts.unshift(node.tagName.toLowerCase() + classes.map((name) => '.' + name).join(''))
      if (node.id) break
      node = node.parentElement
    }
    return parts.join(' > ')
  }
  const isVisible = (el) => {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility !== 'visible' || style.opacity === '0') return false
    if (el.classList.contains('sr-only')) return false
    const rect = el.getBoundingClientRect()
    return rect.width >= 2 && rect.height >= 2
  }
  const failures = []
  const skipped = []
  // 封面占位图：整个 .cover 是 aria-hidden 的装饰性图形，名称在同一行/标题里另有纯文本，
  // 按 WCAG 1.4.3「纯装饰」豁免；这里仍把比值记进 skipped，便于人工复核。
  const decorative = []
  const stats = { text: 0, icon: 0 }
  for (const el of document.querySelectorAll('body *')) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'PATH', 'CIRCLE', 'RECT', 'LINE'].includes(el.tagName)) continue
    if (!isVisible(el) || el.closest('[disabled], [aria-disabled="true"]')) continue
    const own = Array.from(el.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent.trim())
      .join('')
    const isIcon = el.matches('.ui-icon, svg')
    const isField = el.matches('input, textarea')
    if (!own && !isIcon && !isField) continue
    const style = getComputedStyle(el)
    const { candidates, gradient, image, opacity } = backgroundOf(el)
    const isDecoration = Boolean(el.closest('.cover'))
    // fade：祖先链累积的 opacity，需要按每个候选底色分别合成再比较
    const report = (base, target, text, kind, fade = 1) => {
      const pairOf = (bg) => {
        const fg = fade < 0.999 ? over({ ...base, a: (base.a === undefined ? 1 : base.a) * fade }, bg) : base
        return { fg, bg, ratio: contrast(fg, bg) }
      }
      const { fg, bg, ratio } = candidates.map(pairOf).reduce((worst, item) => (item.ratio < worst.ratio ? item : worst))
      const record = {
        selector: selectorOf(el),
        kind,
        text: text.slice(0, 40),
        fg: hexOf(fg),
        bg: hexOf(bg),
        tokens: namesOf(fg),
        bgTokens: namesOf(bg),
        ratio: round(ratio),
        target,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        gradient,
      }
      if (isDecoration) decorative.push(record)
      else if (record.ratio + 1e-9 < target) failures.push(record)
      else if (image) skipped.push(record)
    }
    if (own) {
      stats.text += 1
      const base = parse(style.color)
      if (base) {
        const size = parseFloat(style.fontSize)
        const weight = Number(style.fontWeight) || 400
        report(base, size >= 18.66 || (size >= 14 && weight >= 700) ? 3 : 4.5, own, 'text', opacity)
      }
    }
    if (isIcon) {
      stats.icon += 1
      const fg = parse(style.color)
      if (fg) report(fg, 3, '<icon>', 'icon')
    }
    if (isField && el.getAttribute('placeholder')) {
      const fg = parse(getComputedStyle(el, '::placeholder').color)
      if (fg) report(fg, 4.5, el.getAttribute('placeholder'), 'placeholder')
    }
  }
  // 焦点环：outline 用的是 --brand，静态比对它在各表面上的可见度（不逐个聚焦）
  const ringFailures = []
  const ring = byName.get('--brand')
  if (ring) {
    for (const name of surfaces) {
      const surface = byName.get(name)
      if (!surface) continue
      const item = { token: name, fg: hexOf(ring), bg: hexOf(surface), ratio: round(contrast(ring, surface)) }
      if (item.ratio < 3) ringFailures.push(item)
    }
  }
  // 细边框参考（1.4.11 的装饰性边界），只报告不判定
  const borderAdvice = []
  for (const name of borders) {
    const color = byName.get(name)
    if (!color) continue
    for (const surfaceName of ['--surface', '--bg', '--surface-muted']) {
      const surface = byName.get(surfaceName)
      if (!surface) continue
      const ratio = round(contrast(color, surface))
      borderAdvice.push({ token: name, surface: surfaceName, fg: hexOf(color), ratio })
    }
  }
  return { failures, skipped, decorative, ringFailures, borderAdvice, stats }
}
