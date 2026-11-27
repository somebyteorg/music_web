# 两个「异常大」chunk 的成因

结论来自 `pnpm exec vite build --sourcemap` 之后的 `dist/assets/*.js.map`（按 sources +
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

## 真正的大块头（仅供对照，本次未改）

- `index-*.js` 172 kB（gzip 55 kB）：@applemusic-like-lyrics/lyric 53.9 kB + ttml 49.5 kB +
  pako 96.7 kB + tus-js-client ~90 kB + url-parse / js-base64 —— 全都落在**入口 chunk**，
  首屏就要下载，但只有详情页歌词面板与上传页会用到。
- `uploadPreparation-*.js` 119 kB：music-metadata + file-type 72 kB + hash-wasm 271 kB（worker）。

## 建议（未实施）

1. `src/utils/lyrics.ts` 的 `@applemusic-like-lyrics/lyric` 改成 `await import()`（或把解析挪进
   `useSongLyrics` 按需加载），lyric + ttml + pako 一起离开入口 chunk。
2. `tus-js-client` 只在上传页需要：同样动态 import，或让 `features/uploads/transport.ts` 在
   第一个任务开跑时再加载。
3. 若要显式切分，给 `manualChunks` 单独分出 vue / pinia / vue-router / vueuse 四个 vendor 包；
   现在它们散落在 Button / useFeedback / query 三个「看着像业务模块」的 chunk 里，缓存粒度很差。
4. 切完 vendor 后 Button / useFeedback 体积会回到百字节级，这两个误导性的 chunk 名自然消失。

以上都是打包配置与加载策略变更，会影响 CI 与首屏缓存策略，因此只记录结论，不在本次改动里实施。
