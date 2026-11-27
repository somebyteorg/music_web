import { expectCount, expectText, openApp } from '../harness.mjs'

/** 读链路：/albums 列表 → 进详情 → 播放全部 → 队列角标 = 曲目数 */
export const flow = {
  name: 'read',
  title: '读链路 /albums → /albums/1 → 播放全部',
  async run({ page, origin }) {
    await openApp(page, origin, '/albums')
    const cards = page.locator('.catalog article.entity-row')
    await cards.first().waitFor({ timeout: 15000 })
    const cardCount = expectCount(await cards.count(), 6, '专辑列表卡片数')
    const firstTitle = (await cards.first().locator('h3').innerText()).trim()

    await cards.first().locator('.entity-main').click()
    await page.waitForSelector('.detail-hero', { timeout: 15000 })
    await page.waitForSelector('.song-row', { timeout: 15000 })
    const tracks = expectCount(await page.locator('.song-row').count(), 4, '详情曲目行数')

    await page.getByRole('button', { name: '播放全部' }).click()
    const badge = page.locator('.player .queue-count')
    await badge.waitFor({ timeout: 15000 })
    const badgeText = expectText(await badge.innerText(), String(tracks), '队列角标')
    const queueLabel = String(await page.locator('.player .queue-button').getAttribute('aria-label'))
    expectText(queueLabel, `播放队列，共 ${tracks} 首`, '队列按钮 aria-label')

    return { cardCount, firstTitle, tracks, badgeText, queueLabel }
  },
}
