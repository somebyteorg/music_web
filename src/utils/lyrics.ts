import type { LyricLine } from '@applemusic-like-lyrics/lyric'
import type {
  EmbeddedLyric,
  LyricFormat,
  LyricInput,
  PreparedLyric,
  StructuredLyric,
} from '@/types/lyrics'

/** 解析器（lyric + ttml + pako，合计约 200 kB）只在第一次真正解析时才加载 */
type LyricModule = typeof import('@applemusic-like-lyrics/lyric')
let lyricModule: Promise<LyricModule> | undefined

export function loadLyricModule(): Promise<LyricModule> {
  if (!lyricModule) {
    lyricModule = import('@applemusic-like-lyrics/lyric').catch((error: unknown) => {
      lyricModule = undefined
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`歌词解析模块加载失败（${reason}），请检查网络后重试。`)
    })
  }
  return lyricModule
}

export function detectLyricFormat(content: string, filename = ''): LyricFormat {
  const extension = filename.split('.').pop()?.toLowerCase()
  if (extension === 'ttml' || /<(?:\w+:)?tt(?:\s|>)/.test(content)) return 'ttml'
  if (
    extension === 'elrc' ||
    /<\d+:\d{2}(?:\.\d+)?>/.test(content) ||
    /^\s*\[\d+:\d{2}(?:\.\d+)?\][^\n[]+\[\d+:\d{2}/m.test(content)
  )
    return 'elrc'
  if (extension === 'lrc' || /^\s*\[\d+:\d{2}(?:[.:]\d+)?\]/m.test(content)) return 'lrc'
  return 'text'
}

const formatTime = (milliseconds: number) => {
  const value = Math.max(0, Math.round(milliseconds))
  const minutes = String(Math.floor(value / 60000)).padStart(2, '0')
  const seconds = String(Math.floor((value % 60000) / 1000)).padStart(2, '0')
  return `${minutes}:${seconds}.${String(value % 1000).padStart(3, '0')}`
}

export interface LyricsResult {
  /** 识别出的格式；纯文本不参与解析，lines 为空 */
  format: LyricFormat
  /** 过滤背景行并按开始时间排序，用来生成结构化歌词 */
  lines: LyricLine[]
  /** 解析器原始输出（未过滤），逐字 LRC 重排要用 */
  raw: LyricLine[]
}

/** 解析歌词文本：只有同步歌词才需要解析器，因此这里按需 import，纯文本直接返回空行 */
export async function parseLyrics(content: string, format?: LyricFormat): Promise<LyricsResult> {
  const detected = format ?? detectLyricFormat(content)
  if (detected === 'text') return { format: detected, lines: [], raw: [] }
  const { parseLrcLike, parseTTML } = await loadLyricModule()
  const raw = detected === 'ttml' ? parseTTML(content).lines : parseLrcLike(content).lines
  const lines = raw
    .filter((line) => !line.isBG && Number.isFinite(line.startTime) && line.startTime >= 0)
    .sort((a, b) => a.startTime - b.startTime)
  return { format: detected, lines, raw }
}

export async function prepareLyrics(input: LyricInput): Promise<PreparedLyric> {
  const content = input.content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
  if (!content) throw new Error('请填写歌词内容。')
  if (content.length > 100000) throw new Error('歌词内容不能超过 100000 个字符。')
  const document: StructuredLyric = {
    displayTitle: input.name,
    lang: input.language || 'und',
    kind: input.kind,
    synced: input.format !== 'text',
    line: [],
  }
  let lrc = content
  if (input.format === 'text') {
    document.line = content.split('\n').map((value) => ({ value }))
  } else {
    const { lines } = await parseLyrics(content, input.format)
    if (!lines.length) throw new Error('没有读到有效的同步歌词，请检查歌词格式和时间标签。')
    document.line = lines.map((line) => ({
      start: Math.round(line.startTime),
      ...(Number.isFinite(line.endTime) && line.endTime >= line.startTime
        ? { end: Math.round(line.endTime) }
        : {}),
      value: line.words
        .map((word) => word.word)
        .join('')
        .trim(),
    }))
    const { stringifyLrcLike } = await loadLyricModule()
    lrc = stringifyLrcLike(lines, {
      mode: 'plain',
      auxiliaryLines: {
        translation: { enabled: false },
        romanization: { enabled: false },
        backgroundVocal: { enabled: false },
      },
    })
  }
  return { ...input, content, source_format: input.format, lrc, structured: [document] }
}

export async function prepareEmbeddedLyrics(
  lyrics: EmbeddedLyric[],
  filename: string,
): Promise<PreparedLyric[]> {
  const versions: PreparedLyric[] = []
  for (const [index, original] of lyrics.entries()) {
    let content = original.text || original.syncText?.map((line) => line.text).join('\n') || ''
    const timed = (original.syncText || []).filter(
      (line): line is { timestamp: number; text: string } =>
        typeof line.timestamp === 'number' &&
        Number.isFinite(line.timestamp) &&
        line.timestamp >= 0,
    )
    const synchronized = original.timeStampFormat !== 1 && timed.length > 0
    if (synchronized) {
      content = timed.map((line) => `[${formatTime(line.timestamp)}]${line.text}`).join('\n')
    }
    if (!content.trim()) continue
    const format = original.format || detectLyricFormat(content)
    if (format === 'elrc' && synchronized) {
      const { raw } = await parseLyrics(content, 'elrc')
      const { stringifySPL } = await loadLyricModule()
      content = stringifySPL(raw)
    }
    const prepared = await prepareLyrics({
      name: `内嵌歌词 ${index + 1}`,
      format,
      kind: 'main',
      language: original.language || 'und',
      source: filename,
      content,
      is_default: versions.length === 0,
    })
    versions.push({
      ...prepared,
      source_format: synchronized ? 'sylt' : format,
      source_data: original,
    })
  }
  return versions
}
