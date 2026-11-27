/**
 * 布局快照的落盘格式：稳定排序、2 空格缩进、一个元素一个块（几何一行、样式一行）。
 *
 * 为什么不用 JSON.stringify(…, null, 2)：那样每个样式属性占一行，单文件上万行、
 * diff 噪声大；这里几何与样式各压成一行，单文件控制在千行级，仍然逐字段可读。
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export function slugifyRoute(routePath) {
  const slug = routePath
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'root'
}

export function snapshotFileName(routePath, width) {
  return `${slugifyRoute(routePath)}-${width}.json`
}

function joinedStyle(style) {
  return Object.entries(style)
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(', ')
}

export function serializeSnapshot(snapshot) {
  const elements = snapshot.elements || []
  const lines = ['{']
  lines.push(`  "version": ${snapshot.version},`)
  lines.push(`  "route": ${JSON.stringify(snapshot.route)},`)
  lines.push(`  "width": ${snapshot.width},`)
  lines.push(`  "viewportHeight": ${snapshot.viewportHeight},`)
  lines.push('  "elements": [')
  elements.forEach((element, index) => {
    const fields = [`"tag": ${JSON.stringify(element.tag)}`]
    if (element.classes) fields.push(`"classes": ${JSON.stringify(element.classes)}`)
    fields.push(
      `"x": ${element.x}, "y": ${element.y}, "width": ${element.width}, "height": ${element.height}`,
    )
    if (element.text) fields.push(`"text": ${JSON.stringify(element.text)}`)
    if (element.style && Object.keys(element.style).length) {
      fields.push(`"style": { ${joinedStyle(element.style)} }`)
    }
    lines.push('    {')
    fields.forEach((field, fieldIndex) => {
      const comma = fieldIndex === fields.length - 1 ? '' : ','
      lines.push(`      ${field}${comma}`)
    })
    lines.push(index === elements.length - 1 ? '    }' : '    },')
  })
  lines.push('  ]')
  lines.push('}')
  return `${lines.join('\n')}\n`
}

function comparableShape(snapshot) {
  return JSON.stringify({
    version: snapshot.version,
    route: snapshot.route,
    width: snapshot.width,
    viewportHeight: snapshot.viewportHeight,
    elements: (snapshot.elements || []).map((element) => ({
      tag: element.tag,
      classes: element.classes || '',
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      text: element.text || '',
      style: element.style || {},
    })),
  })
}

/** 写快照前先回读一遍：保证自定义排版永远是合法且无损的 JSON。 */
export async function writeSnapshotFile(filePath, snapshot) {
  const text = serializeSnapshot(snapshot)
  const roundTrip = JSON.parse(text)
  if (comparableShape(roundTrip) !== comparableShape(snapshot)) {
    throw new Error(`快照序列化与内存数据不一致：${filePath}`)
  }
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, text)
  return Buffer.byteLength(text)
}

export async function readSnapshotFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

export function formatBytes(bytes) {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`
}
