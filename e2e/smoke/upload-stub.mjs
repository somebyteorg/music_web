/**
 * 冒烟用的上传后端：tus 直传 + 上传会话。
 *
 * 只查数据的用例不需要它；上传链路必须真的走一次 tus 才能验证
 * 「建会话 → 分片追加 → 轮询处理 → 入库」这一串状态迁移，所以实现最小可用子集：
 *
 *   POST   /api/uploads     建会话，返回 tus endpoint
 *   POST   /upload/:id      tus 创建（读 Upload-Length）
 *   HEAD   /upload/:id      查 offset（续传时用）
 *   PATCH  /upload/:id      追加分片
 *   GET    /api/uploads/:id 处理状态：offset 到齐即 complete + 文件
 *
 * 完成的文件进 files()，stub-api 把它拼进 /api/catalog/songs/:id 的 files，
 * 「详情页资源表出现该文件」才断言得到。
 */
import { audioFiles } from '../fixtures.mjs'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}
const TUS_HEADERS = { 'tus-resumable': '1.0.0', 'cache-control': 'no-store' }

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.writeHead(status, { ...JSON_HEADERS })
  res.end(JSON.stringify(body))
}

export function createUploadStub() {
  const sessions = new Map()
  const files = []
  let counter = 0

  function fileOf(session) {
    return {
      ...audioFiles[0],
      id: `file-smoke-${session.id}`,
      song_id: session.songId,
      file_name: session.fileName,
      file_size: session.length,
      mime_type: 'audio/wav',
      quality: 'standard',
      codec: 'pcm_s16le',
      bitrate: 256,
      sample_rate: 8000,
      bit_depth: 16,
      duration: 0.2,
      is_default: false,
      metadata: {},
    }
  }

  /** 分片传完就产出一份文件；轮询与入库都读这一份，避免重复生成 */
  function complete(session) {
    if (session.file) return session.file
    session.file = fileOf(session)
    files.push(session.file)
    return session.file
  }

  async function handle(req, res, url, method) {
    if (url.pathname === '/api/uploads' && method === 'POST') {
      const raw = String(await readBody(req))
      const body = raw ? JSON.parse(raw) : {}
      counter += 1
      const id = `smoke-upload-${counter}`
      sessions.set(id, {
        id,
        songId: typeof body.song_id === 'string' ? body.song_id : '',
        fileName: typeof body.file_name === 'string' ? body.file_name : 'upload.bin',
        length: Number(body.file_size) || 0,
        offset: 0,
        file: undefined,
      })
      return sendJson(res, 201, {
        session: { id },
        token: 'smoke-token',
        endpoint: `/upload/${id}`,
      })
    }
    const match = url.pathname.match(/^\/upload\/([^/]+)$/)
    if (!match) return sendJson(res, 404, { message: `未定义的上传接口：${method} ${url.pathname}` })
    const id = match[1]
    const session = sessions.get(id)
    if (!session) return sendJson(res, 404, { message: `未知上传会话：${id}` })
    const origin = req.headers.host ? `http://${req.headers.host}` : ''
    if (method === 'POST') {
      await readBody(req)
      const length = Number(req.headers['upload-length'])
      if (Number.isFinite(length) && length > 0) session.length = length
      res.writeHead(201, { ...TUS_HEADERS, location: origin + url.pathname, 'upload-offset': '0' })
      return res.end()
    }
    if (method === 'HEAD') {
      res.writeHead(200, {
        ...TUS_HEADERS,
        'upload-offset': String(session.offset),
        'upload-length': String(session.length),
      })
      return res.end()
    }
    if (method === 'PATCH') {
      const chunk = await readBody(req)
      session.offset += chunk.length
      if (session.length > 0 && session.offset >= session.length) complete(session)
      res.writeHead(204, { ...TUS_HEADERS, 'upload-offset': String(session.offset) })
      return res.end()
    }
    return sendJson(res, 405, { message: `tus 不支持 ${method}` })
  }

  /** GET /api/uploads/:id：前端轮询的处理状态 */
  function status(res, id) {
    const session = sessions.get(id)
    if (!session) return sendJson(res, 404, { message: `未知上传会话：${id}` })
    if (session.length > 0 && session.offset >= session.length) {
      return sendJson(res, 200, {
        session: { status: 'complete', error: null, tus_id: id },
        file: complete(session),
      })
    }
    return sendJson(res, 200, {
      session: { status: 'processing', error: null, tus_id: id },
      file: null,
    })
  }

  return {
    handle,
    status,
    files: () => files,
    sessionCount: () => sessions.size,
  }
}
