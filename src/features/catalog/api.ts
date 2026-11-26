/**
 * 目录域 API：统一走 lib/api 的类型化实现，这里只保留历史命名的薄别名。
 * 新代码请直接 import { catalogApi } from '@/lib/api/catalog'。
 */
import { catalogApi } from '@/lib/api/catalog'

export { catalogPath } from '@/lib/api/catalog'

export const getCatalogPage = catalogApi.page
export const getCatalogItem = catalogApi.item
export const saveCatalogItem = catalogApi.save
export const removeCatalogItem = catalogApi.remove
export const makePlaylistPrivate = catalogApi.privatePlaylist
