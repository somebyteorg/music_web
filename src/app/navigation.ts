export const navigation = [
  {
    label: '曲库',
    items: [
      { to: '/', label: '首页', icon: 'M4 11 12 3l8 8M6 9.5V21h12V9.5M10 21v-6h4v6' },
      { to: '/libraries', label: '媒体库', icon: 'M3 6h18v14H3V6Zm3-3h12M7 10h10M7 14h7' },
      {
        to: '/albums',
        label: '专辑',
        icon: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 12a6 6 0 0 1 6-6',
      },
      {
        to: '/songs',
        label: '歌曲',
        icon: 'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z',
      },
      {
        to: '/artists',
        label: '歌手',
        icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
      },
      { to: '/playlists', label: '歌单', icon: 'M4 5h16M4 11h10M4 17h7M18 11v9m-3-3 3 3 3-3' },
    ],
  },
  {
    label: '协作',
    items: [
      {
        to: '/uploads',
        label: '上传文件',
        icon: 'M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5',
      },
      { to: '/history', label: '操作记录', icon: 'M3 12a9 9 0 1 0 2.6-6.4L3 8m0-5v5h5m4-1v5l3 2' },
      {
        to: '/members',
        label: '成员',
        icon: 'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM5 21v-3a7 7 0 0 1 14 0v3M19 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v3M5 4a3 3 0 0 0 0 6m-2 4a5 5 0 0 0-2 4v3',
      },
    ],
  },
]
