import { describe, expect, it } from 'vitest'
import type { LyricInput } from '@/types/lyrics'
import {
  detectLyricFormat,
  loadLyricModule,
  parseLyrics,
  prepareEmbeddedLyrics,
  prepareLyrics,
} from './lyrics'

const input = (overrides: Partial<LyricInput> = {}): LyricInput => ({
  name: '官方原文',
  format: 'lrc',
  kind: 'main',
  language: 'zh-Hans',
  source: '',
  content: '[00:01.00]第一行\n[00:03.50]第二行',
  is_default: true,
  ...overrides,
})

/** 解析器是动态 import 的：这里断言它返回的是同一份真实模块，而不是被打桩的空对象 */
it('解析器按需加载且只加载一次', async () => {
  const first = await loadLyricModule()
  const second = await loadLyricModule()
  expect(second).toBe(first)
  expect(typeof first.parseLrcLike).toBe('function')
  expect(typeof first.parseTTML).toBe('function')
  expect(typeof first.stringifyLrcLike).toBe('function')
  expect(typeof first.stringifySPL).toBe('function')
})

describe('detectLyricFormat', () => {
  it('按扩展名与内容识别四种格式', () => {
    expect(detectLyricFormat('[00:01.00]一行')).toBe('lrc')
    expect(detectLyricFormat('[00:01.00]<00:01.00>逐<00:01.30>字')).toBe('elrc')
    expect(detectLyricFormat('<tt xmlns="http://www.w3.org/ns/ttml"></tt>')).toBe('ttml')
    expect(detectLyricFormat('第一行\n第二行')).toBe('text')
    expect(detectLyricFormat('第一行', 'a.ttml')).toBe('ttml')
    expect(detectLyricFormat('第一行', 'a.elrc')).toBe('elrc')
    expect(detectLyricFormat('第一行', 'a.lrc')).toBe('lrc')
  })
})

describe('parseLyrics', () => {
  it('LRC 给出开始时间与整行文本', async () => {
    const result = await parseLyrics('[00:01.00]第一行\n[00:03.50]第二行')
    expect(result.format).toBe('lrc')
    expect(result.lines.map((line) => line.startTime)).toEqual([1000, 3500])
    expect(result.lines.map((line) => line.words.map((word) => word.word).join(''))).toEqual([
      '第一行',
      '第二行',
    ])
  })

  it('逐字 LRC 保留每个字的词元', async () => {
    const result = await parseLyrics('[00:01.00]<00:01.00>逐<00:01.30>字', 'elrc')
    expect(result.format).toBe('elrc')
    expect(result.lines[0]?.words.map((word) => word.word)).toEqual(['逐', '字'])
  })

  it('纯文本不解析，返回空行', async () => {
    const result = await parseLyrics('第一行\n第二行')
    expect(result).toEqual({ format: 'text', lines: [], raw: [] })
  })
})

describe('prepareLyrics', () => {
  it('纯文本按行拆分，不标记同步', async () => {
    const prepared = await prepareLyrics(input({ format: 'text', content: '第一行\n第二行' }))
    expect(prepared.structured[0]?.synced).toBe(false)
    expect(prepared.structured[0]?.line).toEqual([{ value: '第一行' }, { value: '第二行' }])
    expect(prepared.lrc).toBe('第一行\n第二行')
  })

  it('LRC 生成结构化行与规整后的 lrc', async () => {
    const prepared = await prepareLyrics(input())
    expect(prepared.structured[0]?.synced).toBe(true)
    // 只比对起唱时间与文本：结束时间是解析器按下一行补的（末行是一个大哨兵值）
    expect(prepared.structured[0]?.line.map(({ start, value }) => ({ start, value }))).toEqual([
      { start: 1000, value: '第一行' },
      { start: 3500, value: '第二行' },
    ])
    expect(prepared.source_format).toBe('lrc')
    // 解析器重排后是毫秒三段式时间标签
    expect(prepared.lrc).toBe('[00:01.000]第一行\n[00:03.500]第二行')
  })

  it('清掉 BOM 与 CRLF 后再解析', async () => {
    const prepared = await prepareLyrics(
      input({ content: '\uFEFF[00:01.00]一行\r\n[00:02.00]二行' }),
    )
    expect(prepared.content).toBe('[00:01.00]一行\n[00:02.00]二行')
    expect(prepared.structured[0]?.line.map((line) => line.value)).toEqual(['一行', '二行'])
  })

  it('空内容与无效同步歌词都抛出可读错误', async () => {
    await expect(prepareLyrics(input({ content: '   ' }))).rejects.toThrow('请填写歌词内容。')
    await expect(prepareLyrics(input({ content: '[00:01.00]' }))).rejects.toThrow(
      '没有读到有效的同步歌词，请检查歌词格式和时间标签。',
    )
  })
})

describe('prepareEmbeddedLyrics', () => {
  it('内嵌同步歌词转成带时间标签的 LRC', async () => {
    const versions = await prepareEmbeddedLyrics(
      [
        {
          timeStampFormat: 2,
          language: 'zh-Hans',
          syncText: [
            { timestamp: 1500, text: '第一行' },
            { timestamp: 61000, text: '第二行' },
          ],
        },
      ],
      'a.flac',
    )
    expect(versions).toHaveLength(1)
    expect(versions[0]?.content).toBe('[00:01.500]第一行\n[01:01.000]第二行')
    expect(versions[0]?.source_format).toBe('sylt')
    expect(versions[0]?.source).toBe('a.flac')
    expect(versions[0]?.is_default).toBe(true)
    expect(versions[0]?.structured[0]?.line.map((line) => line.value)).toEqual(['第一行', '第二行'])
  })

  it('内嵌纯文本歌词按检测到的格式原样保存', async () => {
    const versions = await prepareEmbeddedLyrics(
      [{ timeStampFormat: 1, text: '第一行\n第二行' }, { text: '   ' }],
      'b.flac',
    )
    expect(versions).toHaveLength(1)
    expect(versions[0]?.source_format).toBe('text')
    expect(versions[0]?.structured[0]?.synced).toBe(false)
  })
})
