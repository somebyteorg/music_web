/**
 * 社区栏目（操作记录 / 成员 / 消息）的固定数据。
 *
 * 与 fixtures.mjs 拆开是为了让每个文件都保持在 300 行以内。
 */

import { adminUser } from './fixtures.mjs'

export const history = [
  {
    id: 1,
    user_id: 1,
    user: adminUser,
    action: 'updated',
    entity_type: 'albums',
    entity_id: '1',
    title: '夜航',
    reason: null,
    before: { name: '夜航' },
    after: { name: '夜航（2021 Remaster）' },
    created_at: '2024-05-01T10:00:00.000Z',
  },
  {
    id: 2,
    user_id: 1,
    user: adminUser,
    action: 'created',
    entity_type: 'songs',
    entity_id: '2',
    title: '灯塔',
    reason: '',
    before: null,
    after: { name: '灯塔' },
    created_at: '2024-04-18T03:20:00.000Z',
  },
]

export const members = [
  { ...adminUser, role: 'admin', created_at: '2023-01-01T00:00:00.000Z' },
  {
    id: 2,
    username: 'editor',
    pseudonym: '编辑小林',
    avatar: null,
    role: 'edit',
    quality: 'high',
    notice_version: '2024-06-visual',
    size_upload: 0,
    created_at: '2023-06-01T00:00:00.000Z',
  },
  {
    id: 3,
    username: 'listener',
    pseudonym: null,
    avatar: null,
    role: 'user',
    quality: 'standard',
    notice_version: null,
    size_upload: 0,
    created_at: '2024-02-01T00:00:00.000Z',
  },
]

export const messages = [
  {
    id: 1,
    title: '欢迎使用跃律',
    body: '你可以在上传页确认待入库音频，并在设置中选择默认音质。',
    link: '/uploads',
    read_at: null,
    created_at: '2024-05-20T00:00:00.000Z',
  },
  {
    id: 2,
    title: '专辑资料已更新',
    body: '《夜航》的发行信息已由管理员补全。',
    link: '/albums/1',
    read_at: '2024-05-21T00:00:00.000Z',
    created_at: '2024-05-21T00:00:00.000Z',
  },
]