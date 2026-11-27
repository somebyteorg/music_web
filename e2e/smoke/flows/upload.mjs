import { expectCount, expectIncludes, openApp } from '../harness.mjs'
import { wavFixture } from '../wav.mjs'

const FILE_NAME = 'smoke-0.2s.wav'
const WAV = wavFixture()

/** 上传链路：/songs/1 → 上传音频 → setInputFiles(WAV) → 轮询到 published → 资源表出现该文件 */
export const flow = {
  name: 'upload',
  title: '上传链路 /songs/1 → 上传音频 → tus → published',
  async run({ page, origin, stub }) {
    await openApp(page, origin, '/songs/1')
    await page.waitForSelector('.resources-card', { timeout: 15000 })
    const rows = page.locator('.resource-table tbody tr')
    const before = expectCount(await rows.count(), 2, '上传前资源表行数')

    await page.getByRole('button', { name: '＋ 上传音频' }).click()
    // 页面里常驻多个未打开的对话框，只锁当前打开的这一个
    const modal = page.locator('dialog.modal[open]')
    await modal.waitFor({ timeout: 10000 })
    const notice = modal.getByRole('checkbox')
    if (await notice.count()) {
      await notice.check()
      await modal.getByRole('button', { name: '确认须知' }).click()
    }
    await modal.getByRole('button', { name: '选择音频文件' }).waitFor({ timeout: 10000 })
    await modal.locator('input[type=file]').setInputFiles({
      name: FILE_NAME,
      mimeType: 'audio/wav',
      buffer: WAV,
    })

    // 任务来自状态机：只有 文件校验 → tus 传输 → 轮询处理 → 入库 全部走通才会变成「已加入歌曲」
    await page.waitForFunction(
      (name) => {
        const list = document.querySelector('.song-upload-list')
        return !!list && list.textContent.includes(name) && list.textContent.includes('已加入歌曲')
      },
      FILE_NAME,
      { timeout: 30000 },
    )
    const taskText = (await modal.locator('.song-upload-list article').innerText()).trim()

    await page.waitForFunction(
      (expected) => document.querySelectorAll('.resource-table tbody tr').length === expected,
      before + 1,
      { timeout: 15000 },
    )
    const after = expectCount(await rows.count(), before + 1, '上传后资源表行数')
    const names = await page.locator('.resource-table .resource-file strong').allInnerTexts()
    expectIncludes(names, FILE_NAME, '资源表文件名')

    const uploaded = stub.uploads.files()
    if (uploaded.length !== 1) throw new Error(`服务端应收到 1 个文件，实际 ${uploaded.length}`)
    if (uploaded[0].file_size !== WAV.length)
      throw new Error(`tus 收到的字节数不符：期望 ${WAV.length}，实际 ${uploaded[0].file_size}`)

    return {
      before,
      after,
      fileName: FILE_NAME,
      bytes: WAV.length,
      task: taskText.replace(/\s+/g, ' '),
      files: names,
    }
  },
}
