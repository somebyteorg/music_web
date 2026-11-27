import { describe, expect, it } from 'vitest'
import { createBatchAlbum, setAlbumField } from './batchModel'
import { useAlbumField } from './batchField'

const writer = { updateAlbum: setAlbumField }

describe('专辑字段写入口', () => {
  it('setAlbumField 只改指定字段', () => {
    const album = createBatchAlbum()
    const before = album.artist_name
    setAlbumField(album, 'name', '新专辑')
    expect(album.name).toBe('新专辑')
    expect(album.artist_name).toBe(before)
  })

  it('useAlbumField 读取当前值', () => {
    const album = createBatchAlbum()
    album.selection = 'none'
    expect(useAlbumField(writer, album, 'selection').value).toBe('none')
  })

  it('useAlbumField 写入时会回传给持有者并更新专辑', () => {
    const album = createBatchAlbum()
    const field = useAlbumField(writer, album, 'release_year')
    field.value = 2024
    expect(album.release_year).toBe(2024)
    field.value = null
    expect(album.release_year).toBeNull()
  })

  it('数组字段写入整组替换', () => {
    const album = createBatchAlbum()
    const field = useAlbumField(writer, album, 'excludedPictureIds')
    field.value = ['p1', 'p2']
    expect(album.excludedPictureIds).toEqual(['p1', 'p2'])
    field.value = []
    expect(album.excludedPictureIds).toEqual([])
  })
})
