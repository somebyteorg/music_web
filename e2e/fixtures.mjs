/**
 * 视觉回归专用的固定数据。
 *
 * 所有时间戳、id、名称都是常量：同一份数据在任意一次运行中生成的 DOM 必须完全一致。
 * 不提供 cover_id / image_url，封面统一走前端的 CSS 占位图，避免图片解码差异。
 */

const T = '2024-01-01T00:00:00.000Z'

function baseEntity(id, name, extra = {}) {
  return {
    id,
    name,
    description: '',
    user_id: 1,
    version: 1,
    created_at: T,
    updated_at: T,
    deleted_at: null,
    ...extra,
  }
}

const cover = null

export const adminUser = {
  id: 1,
  username: 'visual-regression',
  pseudonym: '视觉回归',
  avatar: null,
  role: 'admin',
  quality: 'lossless',
  notice_version: null,
  size_upload: 1073741824,
}

export const libraries = [
  baseEntity('lib-1', '主媒体库', {
    description: '日常播放与整理使用的主媒体库。',
    is_default: true,
    songs_count: 10,
    albums_count: 6,
    owner: adminUser,
    creator: adminUser,
  }),
  baseEntity('lib-2', '存档库', {
    description: '不再常听、但仍需保留的发行版本。',
    is_default: false,
    songs_count: 3,
    albums_count: 2,
    owner: adminUser,
    creator: adminUser,
  }),
]

const person = (id, name) => ({ id, name, cover_id: cover, image_url: null })

export const artists = [
  baseEntity('artist-1', '林间电台', {
    description: '成立于 2017 年的氛围流行组合。',
    albums_count: 2,
    songs_count: 7,
    ...person('artist-1', '林间电台'),
  }),
  baseEntity('artist-2', '北纬三十', {
    description: '用民谣记录旧城生活的独立歌手。',
    albums_count: 1,
    songs_count: 1,
    ...person('artist-2', '北纬三十'),
  }),
  baseEntity('artist-3', '海边信号', {
    description: '电子与海浪采样。',
    albums_count: 1,
    songs_count: 1,
    ...person('artist-3', '海边信号'),
  }),
  baseEntity('artist-4', '雾中花园', {
    description: '梦幻流行双人组。',
    albums_count: 1,
    songs_count: 1,
    ...person('artist-4', '雾中花园'),
  }),
]

const artist = (id) => artists.find((item) => item.id === id)
const mainLibrary = libraries[0]

function album(id, name, artistId, year, edition, description) {
  const owner = artist(artistId)
  return baseEntity(id, name, {
    description,
    artists: [owner],
    library: mainLibrary,
    library_id: mainLibrary.id,
    release_date: `${year}-01-01`,
    release_year: year,
    edition,
    release_country: '中国',
    label: '萤火唱片',
    catalog_number: `FF-00${id}`,
    genre: '氛围流行',
    songs_count: 4,
    total_discs: 1,
    total_tracks: 4,
  })
}

export const albums = [
  album(
    '1',
    '夜航',
    'artist-1',
    2021,
    '首版',
    '一张关于夜间飞行与城市灯火的氛围流行专辑，录制于 2021 年冬天。整张专辑用木质吉他与模拟合成器铺底，保留了现场录音的环境声。',
  ),
  album('2', '雨停之前', 'artist-1', 2022, '豪华版', '雨季写下的六首歌，以钢琴与弦乐为主。'),
  album('3', '旧城手记', 'artist-2', 2019, '再版', '关于旧城拆迁与日常生活的民谣记录。'),
  album('4', '潮汐电台', 'artist-3', 2023, '首版', '潮汐采样与合成器交织的电子专辑。'),
  album('5', '午夜花园', 'artist-4', 2020, '首版', '梦幻流行与慢拍的组合。'),
  album('6', '归途', 'artist-1', 2018, '首版', '早期现场录音的整理合集。'),
]

const albumById = (id) => albums.find((item) => item.id === id)

function song(id, name, artistId, albumId, track, favorite = false) {
  const owner = artist(artistId)
  const record = albumById(albumId)
  return baseEntity(id, name, {
    artists: [owner],
    albums: [
      {
        ...person(record.id, record.name),
        release_year: record.release_year,
        pivot: { id: `entry-${id}`, disc_number: 1, track_number: track, version: 1 },
      },
    ],
    library: mainLibrary,
    library_id: mainLibrary.id,
    files_count: id === '1' ? 2 : 1,
    duration: 180 + Number(id) * 7,
    genre: '氛围流行',
    recording_version: id === '1' ? '2021 Remaster' : '',
    is_favorite: favorite,
    available: true,
  })
}

export const songs = [
  song('1', '夜航', 'artist-1', '1', 1, true),
  song('2', '灯塔', 'artist-1', '1', 2),
  song('3', '候鸟', 'artist-1', '1', 3),
  song('4', '清晨五点', 'artist-1', '1', 4),
  song('5', '雨停之前', 'artist-1', '2', 1),
  song('6', '屋檐', 'artist-1', '2', 2),
  song('7', '湿街', 'artist-1', '2', 3),
  song('8', '旧城手记', 'artist-2', '3', 1),
  song('9', '潮汐电台', 'artist-3', '4', 1),
  song('10', '午夜花园', 'artist-4', '5', 1),
]

export const playlists = [
  baseEntity('pl-1', '深夜循环', {
    description: '适合夜间工作的慢速曲目。',
    is_public: true,
    songs_count: 12,
    owner: adminUser,
    creator: adminUser,
    collaborators: [],
  }),
  baseEntity('pl-2', '私人草稿', {
    description: '',
    is_public: false,
    songs_count: 3,
    owner: adminUser,
    creator: adminUser,
    collaborators: [],
  }),
]

function audioFile(id, name, quality, codec, mimeType, extra = {}) {
  return {
    id,
    user_id: 1,
    song_id: '1',
    kind: 'audio',
    file_name: name,
    file_size: 12000000,
    mime_type: mimeType,
    quality,
    codec,
    bitrate: 320,
    sample_rate: 44100,
    bit_depth: 16,
    channels: 2,
    duration: 245,
    is_default: false,
    metadata: {},
    updated_at: '2024-03-02T08:30:00.000Z',
    deleted_at: null,
    uploader: adminUser,
    ...extra,
  }
}

export const audioFiles = [
  audioFile('file-1', '01 夜航.flac', 'lossless', 'flac', 'audio/flac', {
    file_size: 33615872,
    bitrate: 968,
    is_default: true,
  }),
  audioFile('file-2', '01 夜航.mp3', 'high', 'mp3', 'audio/mpeg', { file_size: 9812345 }),
]

export const pendingFiles = [
  audioFile('file-pending-1', '未整理 - 夏夜.ogg', 'high', 'vorbis', 'audio/ogg', {
    song_id: null,
    file_size: 8123456,
    bitrate: 256,
    sample_rate: 48000,
    duration: 198,
    updated_at: '2024-06-01T02:30:00.000Z',
    preview: { cover_id: null, lyrics: [], warnings: [], matches: [] },
  }),
  audioFile('file-pending-2', '未整理 - 迟到的信.wav', 'standard', 'pcm_s16le', 'audio/wav', {
    song_id: null,
    file_size: 42123456,
    bitrate: 1411,
    sample_rate: 44100,
    bit_depth: 16,
    duration: 232,
    updated_at: '2024-06-02T11:05:00.000Z',
    preview: { cover_id: null, lyrics: [], warnings: [], matches: [] },
  }),
]

export const contribution = {
  max_file_size: 1073741824,
  max_cover_size: 10485760,
  chunk_size: 8388608,
  max_chunk_size: 33554432,
  audio_extensions: ['mp3', 'flac', 'wav', 'm4a', 'ogg'],
  cover_extensions: ['jpg', 'jpeg', 'png', 'webp'],
  quality_labels: { standard: '标准', high: '高品质', lossless: '无损', hires: 'Hi-Res' },
  notice: {
    version: '2024-06-visual',
    text: '1. 上传前请确认拥有音频的发布权利。\n2. 请勿上传来源不明的整轨转录文件。\n3. 封面建议使用 1000×1000 以上的正方形图片。',
  },
}

export const session = {
  user: adminUser,
  contribution,
  sign_url: 'https://music.emos.best/sign?visual=1',
  login_error: null,
  server_url: 'https://music.emos.best',
  todb_enabled: true,
}

export const albumDetails = Object.fromEntries(
  albums.map((item) => [
    item.id,
    {
      item: {
        ...item,
        total_tracks: songs.filter((entry) => entry.albums[0].id === item.id).length,
      },
      can_edit: true,
    },
  ]),
)

export const songDetails = Object.fromEntries(
  songs.map((item) => [
    item.id,
    {
      item: { ...item, files: item.id === '1' ? audioFiles : [] },
      can_edit: true,
    },
  ]),
)
