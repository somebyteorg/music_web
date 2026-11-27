import { describe, expect, it } from 'vitest'
import { readTracksPage, resolveTracksStatus } from './tracksStatus'

const base = { type: 'albums' as const, hasData: false, busy: false, error: '' }

describe('曲目区状态机', () => {
  it('歌曲详情不查询曲目，状态固定 idle', () => {
    expect(resolveTracksStatus({ ...base, type: 'songs', hasData: true })).toBe('idle')
  })

  it('首次请求中为 loading', () => {
    expect(resolveTracksStatus({ ...base, busy: true })).toBe('loading')
  })

  it('无数据且失败为 error', () => {
    expect(resolveTracksStatus({ ...base, error: '服务器出错了' })).toBe('error')
  })

  it('已有数据且失败仍为 error，避免旧列表掩盖失败', () => {
    expect(resolveTracksStatus({ ...base, hasData: true, error: '服务器出错了' })).toBe('error')
  })

  it('有数据为 ready；后台刷新中仍展示旧数据', () => {
    expect(resolveTracksStatus({ ...base, hasData: true })).toBe('ready')
    expect(resolveTracksStatus({ ...base, hasData: true, busy: true })).toBe('ready')
  })

  it('未发起请求且无数据为 idle', () => {
    expect(resolveTracksStatus(base)).toBe('idle')
  })
})

describe('曲目数据读取约束', () => {
  it('ready 且数据存在时返回数据', () => {
    const page = { items: [1], total: 1, page: 1, page_size: 24 }
    expect(readTracksPage('ready', page)).toBe(page)
  })

  it.each(['idle', 'loading', 'error'] as const)('%s 状态读取直接抛错', (status) => {
    expect(() => readTracksPage(status, { items: [] })).toThrow('曲目数据未就绪')
  })

  it('ready 但数据为空属于契约错误，同样抛错', () => {
    expect(() => readTracksPage('ready', null)).toThrow('曲目数据未就绪')
  })
})
