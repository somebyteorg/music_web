# 跃律 EMOS MUSIC · Web 前端

Vue 3.5 + TypeScript + Vite + Pinia，部署在 Cloudflare Workers 静态资源，接口走同源 `/api`（Laravel）。

## 常用命令

```bash
pnpm dev              # 本地开发（vite，/api 与 /rest 代理由 vite.config.ts 提供）
pnpm typecheck        # vue-tsc（app + node 两套 tsconfig）
pnpm lint             # ESLint flat config
pnpm test             # Vitest 单测
pnpm build            # typecheck + vite build
pnpm format           # prettier --write src vite.config.ts
```

## 结构

```
src/lib/api/         唯一 HTTP 出口：client.ts（ApiError / CSRF / 401 广播）+ 按域拆分的 typed api
src/lib/query/       极简查询层：useQuery（key + staleTime + 取消 + 缓存）与 useLatest（只保留最新请求）
src/features/<域>/   业务域：api 调用、状态机、组合式函数、域内组件（catalog / uploads / community / editor）
src/components/ui/   UI 组件：Button / IconButton / TextButton / ButtonGroup / Card / Tag / Tabs / Field
src/styles/          样式分层：tokens（结构）/ tokens-light / tokens-dark / base / controls / forms / components / responsive
src/views/           路由级页面，只做组合与接线
```

约定：

- 所有请求走 `lib/api` 的 typed api，不在业务层拼 URL；失败抛 `ApiError`（带 `status` 与响应体）
- 列表/详情读数据走 `lib/query`；不要手写 AbortController 或模块级缓存
- 上传域是状态机：`features/uploads/machine.ts`（纯函数）+ `repository` / `transport` / `persistence`，`stores/uploads.ts` 只做编排
- 样式只用 token，不写死颜色；组件 scoped 样式随元素走

## 自动门禁（CI）

`.github/workflows/ci.yml`：`lint` → `test` → `build` → **布局快照**（`pnpm test:layout`）。

布局快照比较「整像素几何 + 颜色 + 结构」，不做像素比对，因此不受字体抗锯齿影响；但**基线必须在与比对相同的环境生成**（当前为 ubuntu runner），本地 macOS 生成的基线会差 2~7px。

```bash
pnpm test:layout         # 对比基线（CI 用）
pnpm test:layout:update  # 生成基线（只能在 ubuntu runner 上执行，见 workflow 的 layout-baseline job）
pnpm test:contrast       # WCAG AA 对比度审计（浅/深），手动
```

## 本地 mock

`e2e/stub-api.mjs` 是确定性 mock 后端（session / catalog / playlists / files / uploads / history / members / inbox），布局快照与对比度审计共用它：

```bash
node e2e/stub-api.mjs --port 8000     # 需要让前端指向它时，用 vite.config.ts 的 proxy
```
