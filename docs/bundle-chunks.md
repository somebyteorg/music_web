# 大 chunk 的成因与处置

成因部分来自 `pnpm exec vite build --sourcemap` 之后的 `dist/assets/*.js.map`（按 sources +
sourcesContent 统计每个 chunk 由哪些模块组成）。没有装额外的分析器，也没有改打包配置。

## Button-*.js（69.9 kB / gzip 27.3 kB）

| 模块                         | 源码体积 |
| ---------------------------- | -------- |
| @vue/runtime-core            | 288 kB   |
| @vue/reactivity              | 56 kB    |
| @vue/shared                  | 25 kB    |
| src/components/ui/Button.vue | 3.8 kB   |

它不是「Button 组件变胖」，而是 **Vue 运行时分包**：`grep -l 'Button-<hash>' dist/assets/*.js`
显示 index 与其余 17 个 chunk 都从它导入，chunk 名只是被打包器取自内部的一个业务模块。

## useFeedback-*.js（44.0 kB / gzip 17.7 kB）

@vue/runtime-dom 68.7 kB + pinia 73.7 kB + ky ~44 kB + dayjs 7.1 kB + src/lib/api/client.ts

- src/stores/sign.ts + src/composables/useFeedback.ts；同样被 index 与另外 9 个 chunk 共享引用。

## 已实施：把只有少数页面用的重依赖移出入口 chunk

`index-*.js` 原本 174.6 kB（gzip 56.1），里头混着四个只有详情页歌词面板 / 上传页才会碰到的
依赖：@applemusic-like-lyrics/lyric（53.9 kB 源码）+ ttml（49.5 kB）+ pako（96.7 kB）+
tus-js-client（~132 kB 源码，含 url-parse / js-base64）。本次只做动态 import，**没有改打包配置**：

| 依赖                | 之前的引入点                         | 现在                                                                 |
| ------------------- | ------------------------------------ | -------------------------------------------------------------------- |
| tus-js-client       | `features/uploads/transport.ts` 顶层 | `tusClient.ts` 的 `loadTus()`，建会话之后、发起传输之前才 `import()` |
| lyric + ttml + pako | `utils/lyrics.ts` 顶层               | `lyrics.ts` 的 `loadLyricModule()`，第一次真正解析歌词时 `import()`  |

### 前后数据（`pnpm exec vite build`）

| 指标                                      | 改前                                       | 改后                     | 变化                           |
| ----------------------------------------- | ------------------------------------------ | ------------------------ | ------------------------------ |
| `index-*.js`                              | 174.56 kB / 56.10 kB gzip                  | 72.21 kB / 25.60 kB gzip | −102.3 kB（−58.6%）            |
| 总 JS 体积（dist/assets/*.js 合计）       | 906,031 B / 36 个 chunk                    | 954,883 B / 39 个 chunk  | +48.9 kB（+5.4%）              |
| `/albums` 首屏 JS（encodedBodySize 合计） | 190,840 B / 18 个 script                   | 160,970 B / 19 个 script | −29,870 B（−15.6%）            |
| `/songs/1` 首屏 JS（同上）                | ≈190.8 kB（与 /albums 同一批 18 个 chunk） | 160,979 B                | −29.9 kB（详见面板不下歌词库） |

新增的两个懒加载 chunk：

| chunk                 | 体积                     | 何时下载                           |
| --------------------- | ------------------------ | ---------------------------------- |
| `amll-lyric-*.js`     | 90.95 kB / 28.25 kB gzip | 保存歌词版本、上传并解析内嵌歌词时 |
| `browser-*.js`（tus） | 60.18 kB / 15.76 kB gzip | 真正开始上传传输时                 |

还有 `rolldown-runtime-*.js`（0.59 kB）：动态 import 之后多出来的共享运行时。

> 首屏数据用 Playwright 统计 `request.sizes().responseBodySize`（vite preview 有 gzip，所以它等于
> 压缩后字节）；`dist` 体积用构建输出。两者口径不同，故分列。

### 为什么总 JS 反而多了 48.9 kB

静态具名导入时，打包器能把 `@applemusic-like-lyrics/lyric`、`ttml`、`tus-js-client` 里没用到的
导出（ASS / YRC / QRC / LQE 等格式的解析与序列化）整段摇掉；改成 `import()` 之后拿到的是整个
模块命名空间，摇树失效。差额就是这部分：**入口少 102.3 kB，两个按需 chunk 合计 151.8 kB**。

取舍：首屏恒定少下 30 kB（gzip），代价是每个「第一次保存歌词 / 第一次上传」多下 28 kB / 16 kB。
考虑到这两件事本来就要等网络请求、且结果会被浏览器缓存，这里认为值得；若将来更在意总量，
可以给这两个依赖单独配 `manualChunks` 或换成只导出所需函数的薄封装。

### 触发时机与失败路径

- 打开 `/songs/1`、打开歌词面板、编辑表单都不会触发下载：面板的「阅读」预览走的是
  `DOMParser` + 正则（`useSongLyrics.ts` 的 `preview`），本来就不依赖该库。
  Playwright 复核：进入歌词面板后仍未请求 `amll-lyric-*.js` / `browser-*.js`。
- 保存歌词：`useSongLyrics.save()` → `await prepareLyrics(...)`，期间弹窗按钮显示「正在保存…」
  （`useAction` 的 busy），失败仍然走 `report()` 的红色提示，不会退化成空数组。
- 上传：`transport.ts` 的 `run()` 在建会话之后 `await loadTus()`；加载失败包装成可读错误后落进
  现有 `failed` 分支（`stage = transfer`），任务卡片显示原因而不是静默失败。

### 验证

- `src/utils/lyrics.test.ts`（11 条）：lrc / elrc 解析、纯文本不加载解析器、BOM 与 CRLF、
  空内容与无效同步歌词的可读错误、内嵌歌词转 LRC。TTML 解析需要 `DOMParser`（node 环境没有），
  因此放到浏览器里比对。
- 浏览器改前/改后比对：同一份 lrc / elrc / text / ttml 内容，在主分支源码与新源码里跑
  `prepareLyrics`，`structured` / `lrc` / `source_format` 完全一致。
- UI 走查（vite preview + stub 后端）：`/songs/1` → 歌词 → 添加版本 → 分别导入 `.ttml`（Apple
  TTML，`<p itunes:key>`）/ `.lrc` / `.elrc` → 保存；抓到的请求体里 `structured[0].line` 与
  `lrc` 均正确，且 `amll-lyric-*.js` 在保存那一刻才下载（28,062 B）。

## 仍未实施

1. 给 `manualChunks` 显式分出 vue / pinia / vue-router / vueuse 四个 vendor 包；现在它们散落在
   Button / useFeedback / query 三个「看着像业务模块」的 chunk 里，缓存粒度很差。
2. 切完 vendor 后 Button / useFeedback 体积会回到百字节级，这两个误导性的 chunk 名自然消失。

这两条都是打包配置变更，会影响 CI 与首屏缓存策略，因此本次只做动态 import，不在这一轮实施。

## 附：另一个大 chunk

`uploadPreparation-*.js` 119 kB：music-metadata + file-type 72 kB + hash-wasm 271 kB（worker），
只在文件校验时才会加载，本来就是按需的。
