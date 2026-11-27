/**
 * 视觉回归的目标清单。
 *
 * 两类目标：
 *   ROUTES — 直接访问即稳定的整页截图，按 3 个宽度各一张；
 *   SCENES — 需要交互（点开弹窗、入队、造空态）才会出现的界面，自带宽度与截图方式。
 *
 * 场景的命名会拼上宽度与主题后缀（如 queue-drawer-1280.dark.png），
 * 保证每个场景都有独立基线图，互不覆盖。
 */

export const THEMES = ['light', 'dark']

export const THEME_LABELS = { light: '浅色', dark: '深色' }

export const VIEWPORT_HEIGHT = 900

export const ROUTES = [
  { path: '/albums', ready: '.catalog' },
  { path: '/albums/1', ready: '.detail-hero' },
  { path: '/songs/1', ready: '.resources-card' },
  { path: '/uploads', ready: '.pending-row' },
  { path: '/settings', ready: '.library-options' },
]

export const WIDTHS = [390, 768, 1280]

/** mock 后端的分页空响应：场景用它造「空列表 / 无任务」的空态。 */
const EMPTY_PAGE = JSON.stringify({ items: [], page: 1, page_size: 24, total: 0 })

function fulfillEmpty(route) {
  return route.fulfill({ status: 200, contentType: 'application/json', body: EMPTY_PAGE })
}

/** /api/files 同时服务已上传文件与待确认文件，只有 pending 那一路置空。 */
function emptyPending(route) {
  const url = new URL(route.request().url())
  return url.searchParams.get('pending') ? fulfillEmpty(route) : route.continue()
}

/** 行内「加入队列」在窄容器里被 CSS 隐藏：窄屏改用 DOM 事件点同一颗按钮，
 * 入队走的仍是应用自己的逻辑，而不是在测试里另造一份队列数据。 */
async function enqueueFirstSong(page) {
  const enqueue = page.locator('.song-row [title="加入队列"]').first()
  if (await enqueue.isVisible()) await enqueue.click()
  else await enqueue.dispatchEvent('click')
  // 入队会弹一条全局提示，等它自己消失，避免提示气泡混进基线图
  await page.waitForSelector('.toast', { timeout: 5000 })
  await page.waitForSelector('.toast', { state: 'detached', timeout: 10000 })
  await page.click('[aria-controls="queue-panel"]')
  await page.waitForSelector('#queue-panel')
}

async function openDialog(page, trigger, ready = 'dialog[open]') {
  await page.click(trigger)
  await page.waitForSelector(ready)
}

export const SCENES = [
  {
    name: 'albums-edit-dialog',
    path: '/albums/1',
    ready: '.detail-hero',
    widths: [1280],
    // 弹窗固定在视口中央，整页截图会把 modal backdrop 切在首屏边界上，故按视口截图
    fullPage: false,
    setup: (page) => openDialog(page, '.detail-hero button:has-text("编辑资料")'),
  },
  {
    name: 'albums-merge-dialog',
    path: '/albums/1',
    ready: '.detail-hero',
    widths: [1280],
    fullPage: false,
    setup: async (page) => {
      await page.click('.detail-hero .action-menu > summary')
      await openDialog(page, '.detail-hero .action-menu-items button:has-text("合并重复资料")')
    },
  },
  {
    name: 'queue-drawer',
    path: '/albums/1',
    ready: '.song-row',
    widths: [1280, 390],
    fullPage: false,
    setup: enqueueFirstSong,
  },
  {
    name: 'song-upload-dialog',
    path: '/songs/1',
    ready: '.resources-card',
    widths: [1280],
    fullPage: false,
    setup: (page) => openDialog(page, 'button:has-text("上传音频")'),
  },
  {
    name: 'uploads-empty',
    path: '/uploads',
    ready: '.ui-placeholder',
    widths: [1280],
    before: (page) => page.route(/\/api\/files\?/, emptyPending),
  },
  {
    name: 'albums-empty',
    path: '/albums',
    ready: '.ui-placeholder',
    widths: [1280],
    before: (page) => page.route(/\/api\/catalog\/albums(\?|$)/, fulfillEmpty),
  },
]

export function shotName(routePath, width) {
  const slug = routePath
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'root'}-${width}`
}

/** 主题后缀：浅色沿用旧命名（albums-1280.png），深色加 .dark（albums-1280.dark.png）。 */
export function themedName(name, theme) {
  return theme === 'dark' ? `${name}.dark` : name
}

export function parseList(value) {
  return value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []
}
