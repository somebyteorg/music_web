import compressionWorkerUrl from 'browser-image-compression/dist/browser-image-compression.js?url'
import type { ArtworkType } from '@/types/catalog'

export function artworkType(name: string): ArtworkType {
  if (/back|封底|背面/i.test(name)) return 'back'
  if (/disc|碟面|光盘/i.test(name)) return 'disc'
  if (/booklet|内页|册页/i.test(name)) return 'booklet'
  if (/^(?:cover|front|folder|album[ _-]?cover|封面|正面)(?:[ ._()-]|\d|$)/i.test(name))
    return 'cover'
  return 'other'
}
export async function prepareArtwork(file: File, limit: number): Promise<File> {
  if (file.size <= limit) return file
  const { default: compress } = await import('browser-image-compression')
  const compressed = await compress(file, {
    maxSizeMB: limit / 1024 / 1024,
    maxWidthOrHeight: 16000,
    alwaysKeepResolution: true,
    fileType: 'image/webp',
    initialQuality: 0.92,
    useWebWorker: true,
    libURL: compressionWorkerUrl,
  })
  const name = file.name.replace(/\.[^.]+$/, '.webp')
  const result = new File([compressed], name, {
    type: 'image/webp',
    lastModified: file.lastModified,
  })
  if (file.webkitRelativePath)
    Object.defineProperty(result, 'webkitRelativePath', {
      value: file.webkitRelativePath.replace(/[^/]+$/, name),
    })
  return result
}
