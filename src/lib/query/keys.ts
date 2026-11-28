import type { CatalogType } from '@/types/catalog'
import { invalidateQueries } from './index'

/**
 * 查询 key 的唯一定义处：形状是 `<userId>:<scope>:<rest>`，各段只用 ':' 分隔。
 *
 * - 前缀一律以 ':' 收尾，所以 `catalog:` 不会误命中 `catalog-other:`
 * - 读的地方用 xxxKeys(userId) 造 key；写的地方用 invalidateScopes(userId, scopes)
 *   声明「这次写影响了哪几块」，字符串只出现在下面的构造器里
 *
 * 写操作 → 失效范围：
 * - 收藏/取消收藏、编辑资料保存、删除/合并/设为私密歌单 → catalog + detail
 * - 资源删除、音频移动、设为系统默认 → detail + pending-uploads
 * - 歌单加曲/删曲/调序、上传入库完成 → catalog + detail + pending-uploads
 * - 会话切换/登出 → clearQueryCache()（整体清空，不走前缀）
 *
 * detail 与 detail-songs 是同一实体的两张表（详情 + 曲目分页），写操作后一起失效。
 */
/** 缓存按用户隔离；User.id 是 number，取 number | string 免得每个调用点都 String() */
type UserId = string | number

const SEP = ':'

export function catalogKeys(userId: UserId) {
  const prefix = `${userId}${SEP}catalog${SEP}`
  return {
    prefix,
    /** 完整路径带上筛选与分页：同一用户的不同列表各自缓存 */
    page: (fullPath: string) => `${prefix}${fullPath}`,
  }
}

export function detailKeys(userId: UserId) {
  const detail = `${userId}${SEP}detail${SEP}`
  const songs = `${userId}${SEP}detail-songs${SEP}`
  return {
    /** 详情与曲目表是一份数据的两个读法，没有只失效一边的道理 */
    prefixes: [detail, songs],
    item: (type: CatalogType, id: string) => `${detail}${type}${SEP}${id}`,
    songs: (type: CatalogType, id: string, page: number, size: number) =>
      `${songs}${type}${SEP}${id}${SEP}${page}${SEP}${size}`,
  }
}

/**
 * 首页楼层。首页只有读：收藏/历史都是本地 localStorage（不走缓存失效），
 * 所以这里不需要 keyPrefixes / KeyScope 映射。
 */
export function homeKeys(userId: UserId) {
  const prefix = `${userId}${SEP}home${SEP}`
  return {
    prefix,
    /** 楼层里的歌曲列表：scope = 这一层用的查询参数（latest / random:7 / artist:xxx / ids:...） */
    songs: (scope: string) => `${prefix}songs${SEP}${scope}`,
    /** 楼层里的专辑详情（常听专辑要拿封面）：scope = 拼好的 id 列表 */
    albums: (scope: string) => `${prefix}albums${SEP}${scope}`,
  }
}

export function pendingUploadKeys(userId: UserId) {
  const prefix = `${userId}${SEP}pending-uploads${SEP}`
  return { prefix, page: (page: number) => `${prefix}${page}` }
}

/** 写操作可能影响的数据块，映射表见文件头注释与 keys.test.ts 的用例 */
export type KeyScope = 'catalog' | 'detail' | 'pending-uploads'

export function keyPrefixes(userId: UserId, scopes: KeyScope[]): string[] {
  return scopes.flatMap((scope) => {
    if (scope === 'catalog') return [catalogKeys(userId).prefix]
    if (scope === 'detail') return detailKeys(userId).prefixes
    return [pendingUploadKeys(userId).prefix]
  })
}

/** 未登录时没有缓存可失效：写操作本来也走不到这里，直接返回比让调用方各自判空更省事 */
export function invalidateScopes(userId: UserId | undefined, scopes: KeyScope[]) {
  if (!userId) return
  invalidateQueries(keyPrefixes(userId, scopes))
}
