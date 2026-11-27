import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createUploadTask, type UploadTask } from './model'
import { useUploadGroups } from './useUploadGroups'

const memory = new Map<string, string>()

beforeEach(() => {
  memory.clear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function task(id: string, relativePath: string, album: string): UploadTask {
  const base = createUploadTask({
    id,
    name: `${id}.flac`,
    size: 100,
    relativePath,
    fingerprint: `${relativePath}:100:0`,
    kind: 'audio',
  })
  return { ...base, metadata: { ...base.metadata, album }, transfer: { progress: 50 } }
}

const sample = () =>
  ref([
    task('a', '专辑一/a.flac', '专辑一'),
    task('b', '专辑一/b.flac', '专辑一'),
    task('c', 'c.flac', ''),
  ])

describe('上传分组方式（music-upload-grouping）', () => {
  it('默认按文件夹分组', () => {
    expect(useUploadGroups(ref([])).groupBy.value).toBe('folder')
  })

  it('记住用户选择的按专辑分组', () => {
    memory.set('music-upload-grouping', 'album')
    expect(useUploadGroups(ref([])).groupBy.value).toBe('album')
  })

  it('读到脏值时回落到按文件夹分组，不崩也不留脏值', () => {
    memory.set('music-upload-grouping', 'date')
    const { groupBy } = useUploadGroups(ref([]))
    expect(groupBy.value).toBe('folder')
  })
})

describe('上传分组', () => {
  it('按文件夹分组：文件名里的目录决定组名', () => {
    const groups = useUploadGroups(sample()).groups.value
    expect(groups.map((group) => [group.name, group.tasks.length])).toEqual([
      ['专辑一', 2],
      ['单独选择的文件', 1],
    ])
    expect(groups[0]!.progress).toBe(50)
  })

  it('按专辑分组：未识别专辑的落到兜底组', () => {
    memory.set('music-upload-grouping', 'album')
    const groups = useUploadGroups(sample()).groups.value
    expect(groups.map((group) => group.name)).toEqual(['专辑一', '未识别专辑'])
  })
})
