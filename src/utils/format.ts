import dayjs from 'dayjs'
export const qualities = { standard: '标准', high: '高品质', lossless: '无损', hires: 'Hi-Res' }
export function bytes(n: number) {
  if (!n) return '0 B'
  const i = Math.min(3, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${['B', 'KiB', 'MiB', 'GiB'][i]}`
}
export function duration(n: number) {
  return `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`
}
/** 00:00 形式（分钟补零，长度固定不抖）：进度、播放时间这类会持续变动的数字用它 */
export function clock(n: number) {
  const value = Math.max(0, Math.round(n))
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
export function date(value: string | null | undefined) {
  return value ? dayjs(value).format('YYYY.MM.DD HH:mm') : '—'
}
export function displayName(user?: { pseudonym?: string | null; username: string }) {
  return user?.pseudonym || user?.username || '用户'
}
