import { computed } from 'vue'
import type { BatchAlbum } from './batchModel'

/** 专辑字段的写入口：由持有者实现，子组件只负责回传字段与值 */
interface AlbumFieldWriter {
  updateAlbum<K extends keyof BatchAlbum>(album: BatchAlbum, key: K, value: BatchAlbum[K]): void
}

/** 把专辑字段包装成可写 computed：setter 只调用持有者的 updateAlbum 动作 */
export function useAlbumField<K extends keyof BatchAlbum>(
  writer: AlbumFieldWriter,
  album: BatchAlbum,
  key: K,
) {
  return computed<BatchAlbum[K]>({
    get: () => album[key],
    set: (value) => writer.updateAlbum(album, key, value),
  })
}
