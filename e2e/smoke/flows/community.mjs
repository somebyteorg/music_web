import { expectCount, openApp } from '../harness.mjs'

const PAGES = [
  { route: '/history', selector: '.history-list > article', count: 2, label: '操作记录条数' },
  { route: '/members', selector: '.member-list > article', count: 3, label: '成员条数' },
  { route: '/inbox', selector: '.message-list .message', count: 2, label: '消息条数' },
]

/** 社区链路：三个栏目各自渲染出 ≥1 条数据，且没有空态占位 */
export const flow = {
  name: 'community',
  title: '社区链路 /history /members /inbox',
  async run({ page, origin }) {
    const pages = []
    for (const item of PAGES) {
      await openApp(page, origin, item.route)
      await page.locator(item.selector).first().waitFor({ timeout: 15000 })
      const count = expectCount(await page.locator(item.selector).count(), item.count, item.label)
      const placeholders = await page.locator('.ui-placeholder').count()
      if (placeholders > 0)
        throw new Error(`${item.route} 不应出现空态占位，实际 ${placeholders} 个 .ui-placeholder`)
      pages.push({ route: item.route, count, placeholders })
    }
    return { pages }
  },
}
