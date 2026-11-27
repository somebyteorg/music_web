/**
 * 确定性 mock 后端：给视觉回归提供固定数据，不依赖真实 API。
 *
 * 用法：
 *   node e2e/stub-api.mjs [--port=8000]
 *   STUB_API_PORT=8100 node e2e/stub-api.mjs
 *
 * 也可以 import { startStubApi } 在测试脚本里启动（端口 0 表示随机可用端口）。
 */

import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'
import {
  albumDetails,
  albums,
  artists,
  audioFiles,
  contribution,
  libraries,
  pendingFiles,
  playlists,
  session,
  songDetails,
  songs,
} from './fixtures.mjs'
import { history, members, messages } from './community-fixtures.mjs'
import { createUploadStub } from './smoke/upload-stub.mjs'

const DEFAULT_PORT = 8000
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}
// 1×1 透明 PNG：为 /api/file/:user/:id 之类的图片请求提供稳定响应
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

/** 上传会话与 tus 直传的 mock：布局快照不用，冒烟链路要用 */
const uploads = createUploadStub()

/**
 * 故障注入：none | songs | detail。
 * - songs：/api/catalog/songs?album_id=... 与 /api/playlists/:id/songs 返回 500
 * - detail：/api/catalog/albums/:id 返回 500
 * 默认 none，视觉回归行为不变。
 */
let failureMode = 'none'

function sendJson(res, status, body) {
  res.writeHead(status, JSON_HEADERS)
  res.end(JSON.stringify(body))
}

function sendEmpty(res, status = 204) {
  res.writeHead(status, { 'cache-control': 'no-store' })
  res.end()
}

function pageOf(items, url, fallbackSize = 24) {
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const pageSize = Math.max(1, Number(url.searchParams.get('page_size')) || fallbackSize)
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    page,
    page_size: pageSize,
    total: items.length,
  }
}

function songsFor(url) {
  const albumId = url.searchParams.get('album_id')
  const artistId = url.searchParams.get('artist_id')
  const libraryId = url.searchParams.get('library_id')
  const q = (url.searchParams.get('q') || '').trim()
  return songs.filter((song) => {
    if (albumId && song.albums[0]?.id !== albumId) return false
    if (artistId && !song.artists.some((item) => item.id === artistId)) return false
    if (libraryId && song.library_id !== libraryId) return false
    if (q && !song.name.includes(q)) return false
    return true
  })
}

function itemFor(kind, id) {
  if (kind === 'songs') {
    const detail = songDetails[id]
    if (!detail) return null
    const uploaded = uploads.files().filter((file) => file.song_id === id)
    if (!uploaded.length) return detail
    // 冒烟上传完成后，详情页的资源表要多出这一行
    const current = Array.isArray(detail.item.files) ? detail.item.files : []
    return { ...detail, item: { ...detail.item, files: [...current, ...uploaded] } }
  }
  if (kind === 'albums') return albumDetails[id]
  if (kind === 'libraries') {
    const item = libraries.find((entry) => entry.id === id)
    return item ? { item, can_edit: true } : null
  }
  if (kind === 'artists') {
    const item = artists.find((entry) => entry.id === id)
    return item ? { item, can_edit: true } : null
  }
  return null
}

function handle(req, res) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const path = url.pathname
  const method = req.method || 'GET'
  // 建会话与 tus 分片都要读请求体，必须抢在 req.resume() 之前
  if (path.startsWith('/upload/') || (path === '/api/uploads' && method === 'POST'))
    return uploads.handle(req, res, url, method)
  req.resume()
  const isGet = method === 'GET'
  let match

  // —— 会话与账号 ——
  if (isGet && path === '/api/session') return sendJson(res, 200, session)
  if (isGet && path === '/api/csrf-token') return sendJson(res, 200, { csrf_token: 'visual-csrf-token' })
  if (method === 'POST' && path === '/api/logout') return sendEmpty(res)
  if (method === 'POST' && path === '/api/notice/accept')
    // 接受须知后返回带 notice_version 的用户，前端 hasNotice 才会放行上传
    return sendJson(res, 200, {
      user: { ...session.user, notice_version: contribution.notice.version },
    })
  if (method === 'PATCH' && path === '/api/profile') return sendJson(res, 200, { user: session.user })
  if (path === '/api/profile/libraries') {
    const payload = {
      libraries: [
        { id: 1, name: '主媒体库' },
        { id: 2, name: '存档库' },
      ],
      library_ids: [1],
    }
    if (isGet) return sendJson(res, 200, payload)
    if (method === 'PUT') return sendJson(res, 200, payload)
  }

  // —— 曲库列表与详情 ——
  if (isGet && path === '/api/catalog/libraries') return sendJson(res, 200, pageOf(libraries, url))
  if (isGet && path === '/api/catalog/albums') return sendJson(res, 200, pageOf(albums, url))
  if (isGet && path === '/api/catalog/artists') return sendJson(res, 200, pageOf(artists, url))
  if (isGet && path === '/api/catalog/songs') {
    if (failureMode === 'songs' && url.searchParams.has('album_id'))
      return sendJson(res, 500, { message: '曲目加载失败（模拟）' })
    return sendJson(res, 200, pageOf(songsFor(url), url, 48))
  }
  if (isGet && (match = path.match(/^\/api\/catalog\/(songs|albums|artists|libraries)\/([^/]+)$/))) {
    if (failureMode === 'detail' && match[1] === 'albums')
      return sendJson(res, 500, { message: '详情加载失败（模拟）' })
    const detail = itemFor(match[1], match[2])
    return detail ? sendJson(res, 200, detail) : sendJson(res, 404, { message: '找不到这个资源。' })
  }
  if (isGet && path === '/api/playlists') return sendJson(res, 200, pageOf(playlists, url))
  if (isGet && (match = path.match(/^\/api\/playlists\/([^/]+)\/songs$/))) {
    if (failureMode === 'songs') return sendJson(res, 500, { message: '曲目加载失败（模拟）' })
    return sendJson(res, 200, pageOf(songsFor(url), url, 48))
  }
  if (isGet && (match = path.match(/^\/api\/playlists\/([^/]+)$/))) {
    const item = playlists.find((entry) => entry.id === match[1])
    return item ? sendJson(res, 200, { item, can_edit: true }) : sendJson(res, 404, { message: '找不到这个歌单。' })
  }

  // —— 文件与上传 ——
  if (isGet && path === '/api/files') {
    const list = url.searchParams.get('pending') ? pendingFiles : audioFiles
    const kind = url.searchParams.get('kind')
    return sendJson(res, 200, pageOf(kind ? list.filter((file) => file.kind === kind) : list, url))
  }
  if (isGet && (match = path.match(/^\/api\/files\/([^/]+)\/image$/))) {
    const file = [...audioFiles, ...pendingFiles].find((entry) => entry.id === match[1])
    return sendJson(res, 200, { file, references: [] })
  }
  if (isGet && (match = path.match(/^\/api\/file\/[^/]+\/([^/]+)$/))) {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' })
    return res.end(TINY_PNG)
  }
  if (method === 'POST' && path === '/api/uploads/check') return sendJson(res, 200, { file: null })
  if (isGet && (match = path.match(/^\/api\/uploads\/([^/]+)$/))) return uploads.status(res, match[1])
  if (method === 'POST' && (match = path.match(/^\/api\/uploads\/([^/]+)\/retry$/))) return sendEmpty(res)
  if (method === 'POST' && (match = path.match(/^\/api\/files\/([^/]+)\/publish$/))) {
    return sendJson(res, 200, { file: audioFiles[0], song_id: '1' })
  }
  if (method === 'POST' && path === '/api/files/publish') {
    return sendJson(res, 200, { items: [{ file: audioFiles[0], song_id: '1', album_id: '1' }] })
  }
  if (method === 'POST' && path === '/api/files/preview') return sendJson(res, 200, { files: audioFiles })
  if (method === 'POST' && path === '/api/albums/matches') return sendJson(res, 200, { items: [] })
  if (isGet && (match = path.match(/^\/api\/albums\/([^/]+)\/positions$/))) {
    return sendJson(res, 200, { items: [] })
  }
  if (method === 'PUT' && path === '/api/files/drafts') return sendEmpty(res)

  // —— 社区 ——
  if (isGet && path === '/api/history') return sendJson(res, 200, pageOf(history, url, 16))
  if (isGet && path === '/api/members') return sendJson(res, 200, pageOf(members, url, 30))
  if (isGet && path === '/api/inbox') return sendJson(res, 200, pageOf(messages, url, 30))
  if (isGet && path === '/api/inbox/unread') return sendJson(res, 200, { count: 2 })
  if (method === 'POST' && path === '/api/inbox/read') return sendEmpty(res)
  if (method === 'POST' && (match = path.match(/^\/api\/history\/([^/]+)\/restore$/))) return sendEmpty(res)
  if (method === 'PATCH' && (match = path.match(/^\/api\/members\/([^/]+)\/role$/))) return sendEmpty(res)

  // —— 常见写操作：统一成功，不做状态变更（截图不依赖） ——
  if (method === 'PUT' && /^\/api\/songs\/[^/]+\/favorite$/.test(path)) return sendEmpty(res)
  if (method === 'PATCH' && /^\/api\/songs\/(library|album)$/.test(path)) return sendEmpty(res)
  if (/^\/api\/playlists\/[^/]+\/(tracks|private)$/.test(path)) {
    return path.endsWith('/private') ? sendJson(res, 200, { message: '已设为私密歌单。' }) : sendEmpty(res)
  }
  if (/^\/api\/(metadata\/|catalog\/.+\/metadata|songs\/.+\/lyrics|.*\/merge)/.test(path)) {
    return isGet ? sendJson(res, 200, { items: [], fields: {}, conflict: null }) : sendEmpty(res)
  }
  if (method !== 'GET' && path.startsWith('/api/')) return sendEmpty(res)
  return sendJson(res, 404, { message: `未定义的 mock 接口：${method} ${path}` })
}

export async function startStubApi(options = {}) {
  failureMode = options.failure ?? failureMode
  const envPort = Number(process.env.STUB_API_PORT ?? process.env.PORT ?? DEFAULT_PORT)
  const port = options.port ?? (Number.isFinite(envPort) ? envPort : DEFAULT_PORT)
  const server = createServer((req, res) => {
    try {
      handle(req, res)
    } catch (error) {
      sendJson(res, 500, { message: error instanceof Error ? error.message : 'mock 服务内部错误' })
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port
  return {
    server,
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}`,
    setFailure: (mode) => {
      failureMode = mode
    },
    // 冒烟用它确认 tus 真的收满了字节
    uploads,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const arg = process.argv.find((value) => value.startsWith('--port='))
  const port = arg ? Number(arg.slice('--port='.length)) : undefined
  const failArg = process.argv.find((value) => value.startsWith('--fail='))
  const failure = failArg ? failArg.slice('--fail='.length) : undefined
  startStubApi({ port, failure })
    .then((stub) => {
      process.stdout.write(`stub api listening on ${stub.url}\n`)
    })
    .catch((error) => {
      process.stderr.write(`stub api failed: ${error instanceof Error ? error.message : error}\n`)
      process.exitCode = 1
    })
}
