# 跃律 EMOS MUSIC · Web 前端

Vue 3.5 + TypeScript + Vite + Pinia，部署在 Cloudflare Workers 静态资源，接口走同源 `/api`（Laravel）。

## 常用命令

```bash
pnpm dev         # 本地开发（/api 与 /rest 代理由 vite.config.ts 提供）
pnpm typecheck   # vue-tsc（app + node 两套 tsconfig）
pnpm lint        # ESLint flat config（含模板层 a11y 规则）
pnpm build       # typecheck + vite build
pnpm format      # prettier --write src vite.config.ts
```

## 架构

```
views/*               路由级页面：只做组合与接线
   |
   +--> app/*         外壳：Gate（登录态）· Topbar · Sidebar · Account
   |
   v
components/*          展示与交互：ui/ · player/ · now-playing/ · queue/ · song-list/ · editor/
   |
   v
features/<domain>     业务域：catalog · uploads · community · editor
   |
   +--> lib/query     useQuery（key + staleTime + 取消 + 缓存）· keys.ts
   +--> stores/*      Pinia：player · queue · uploads · sign
   +--> composables/* 共享逻辑：滚动渐隐 · FLIP · 跑马灯 · 元信息
              |
              v
         lib/api       client.ts：ApiError / CSRF / 401 广播 + 按域 typed api
              |
              v
         /api（Laravel，同源）+ /rest（上传域）
```

**读**：`views` → `features/<域>` 的 query → `lib/query`（key 来自 `keys.ts`）→ `lib/api` → `/api`。  
**写**：`features` → `lib/api` 的 typed api → 成功后 `invalidateScopes()` 失效前缀，列表自动重取。  
**播放**：`SongList` / `DetailHero` 等只调 `stores/queue` 的 `playList/append/insertNext`；`stores/player` 持有 `audio` 与当前曲目，`components/player/*` 与 `components/now-playing/*` 都是它的视图。

## 目录

```
src/lib/api/         唯一 HTTP 出口：client.ts（ApiError / CSRF / 401 广播）+ 按域拆分的 typed api
src/lib/query/       极简查询层：useQuery（key + staleTime + 取消 + 缓存）、useLatest、keys.ts（key 单一定义处）
src/lib/telemetry.ts 错误采集（归一化 / 指纹去重 / 限流 / sendBeacon 降级），端点由 VITE_ERROR_ENDPOINT 提供
src/features/<域>/   业务域：api 调用、状态机、组合式函数、域内组件（catalog / uploads / community / editor）
src/stores/          Pinia：player（播放）、queue（队列）、uploads、sign 等
src/composables/     跨域共享逻辑：useQuery 封装、MarqueeText 的滚动、useScrollFade、useFlipMorph、usePlayerMeta
src/components/ui/   UI 组件：Button / IconButton / TextButton / ButtonGroup / Card / Tag / Tabs / Field / EmptyState …
src/components/player/     播放器：PlayerBar 外壳 + Track / Transport / Seek / Actions / ModeButton
src/components/now-playing/ 全屏歌词页：NowPlaying 外壳 + Backdrop / Header / Artwork / Lyrics / Queue / Empty
src/styles/          样式分层：tokens / tokens-light / tokens-dark / base / controls / forms / components / responsive
src/views/           路由级页面，只做组合与接线
src/workers/         上传预处理 Worker（音频元数据/封面，按需加载）
```

## 约定

- 所有请求走 `lib/api` 的 typed api，不在业务层拼 URL；失败抛 `ApiError`（带 `status` 与响应体）
- 列表/详情读数据走 `lib/query`；key 只在 `lib/query/keys.ts` 里构造，写操作后 `invalidateScopes()` 失效前缀
- 上传域是状态机：`features/uploads/machine.ts`（纯函数）+ `repository` / `transport`（`transport/` 目录）/ `persistence`，`stores/uploads.ts` 只做编排
- 重依赖按需加载：`tus-js-client`、歌词解析器、上传预处理 Worker 都是 `import()`，不要改回顶层静态导入（会把首屏入口撑大 100KB+）
- 样式只用 token，不写死颜色；组件 scoped 样式随元素走；`@layer` 顺序在 `index.html` 与 `src/style.css` 两处声明，改动需同步
- 单文件 ≤300 行；禁用 `!important`、`as any`、`eslint-disable` 与 `?? []` 之类兜底

## 无障碍

- 模板层规则由 `eslint-plugin-vuejs-accessibility` 在 `pnpm lint` 里强制（`label-has-for` 收窄为「包裹控件或 id+for 之一」）
- 交互一律用原生控件；纯装饰图标 `aria-hidden`，可点区域是 `<button>`（含遮罩层）
- 弹层：`role="dialog" aria-modal="true"`、打开聚焦首个可操作项、关闭焦点归还触发元素；Esc 分层退出
- 点击热区 ≥44px；`prefers-reduced-motion` 下关闭过渡与动画（`@layer a11y`）
- 人工复核可用 devtools 的 axe 扩展，或任意 axe runner 对 `pnpm preview` 的页面跑一遍

## CI

`.github/workflows/ci.yml`：`lint` → `build`（typecheck + vite build）。没有测试与视觉门禁，回归靠人工验证。

错误上报默认**不上报**（`VITE_ERROR_ENDPOINT` 为空时只保留内存环形缓冲）；配置该环境变量才会向端点 `POST`。