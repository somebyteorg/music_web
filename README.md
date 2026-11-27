# 跃律 EMOS MUSIC · Web 前端

Vue 3.5 + TypeScript + Vite + Pinia，部署在 Cloudflare Workers 静态资源，接口走同源 `/api`（Laravel）。

## 常用命令

```bash
pnpm dev         # 本地开发（/api 与 /rest 代理由 vite.config.ts 提供）
pnpm typecheck   # vue-tsc（app + node 两套 tsconfig）
pnpm lint        # ESLint flat config
pnpm build       # typecheck + vite build
pnpm format      # prettier --write src vite.config.ts
```

## 结构

```
src/lib/api/         唯一 HTTP 出口：client.ts（ApiError / CSRF / 401 广播）+ 按域拆分的 typed api
src/lib/query/       极简查询层：useQuery（key + staleTime + 取消 + 缓存）、useLatest、keys.ts（key 单一定义处）
src/features/<域>/   业务域：api 调用、状态机、组合式函数、域内组件（catalog / uploads / community / editor）
src/components/ui/   UI 组件：Button / IconButton / TextButton / ButtonGroup / Card / Tag / Tabs / Field
src/styles/          样式分层：tokens / tokens-light / tokens-dark / base / controls / forms / components / responsive
src/views/           路由级页面，只做组合与接线
```

## 约定

- 所有请求走 `lib/api` 的 typed api，不在业务层拼 URL；失败抛 `ApiError`（带 `status` 与响应体）
- 列表/详情读数据走 `lib/query`；key 只在 `lib/query/keys.ts` 里构造，写操作后 `invalidateScopes()` 失效前缀
- 上传域是状态机：`features/uploads/machine.ts`（纯函数）+ `repository` / `transport` / `persistence`，`stores/uploads.ts` 只做编排
- 重依赖按需加载：`tus-js-client`、歌词解析器都是 `import()`，不要改回顶层静态导入（会把首屏入口撑大 100KB+）
- 样式只用 token，不写死颜色；组件 scoped 样式随元素走

## CI

`.github/workflows/ci.yml`：`lint` → `build`（typecheck + vite build）。没有测试与视觉门禁，回归靠人工验证。

错误上报默认**不上报**（`VITE_ERROR_ENDPOINT` 为空时只保留内存环形缓冲）；配置该环境变量才会向端点 `POST`。
