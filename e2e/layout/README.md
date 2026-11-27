# 布局快照（e2e/layout）

`pnpm test:layout` 是**不依赖字体**的视觉门禁：它不截图，而是把每条路由的可见元素录成
「标签 + class 签名 + 整像素盒子 + 布局/颜色相关计算样式」，与 `e2e/__layout__/*.json` 比对。

## 记录了什么

- 元素：`tag`、排序去重后的 class 签名、`x/y/width/height`（`Math.round` 到整像素）、
  直接文本节点前 20 字（仅用于把同一元素对齐）；
- 样式：`display`/`position`/flex/grid 全套、`padding`/`margin`/`border-width`/`border-radius`
  四边、`font-size`/`font-weight`/`line-height`/`letter-spacing`、`color`/`background-color`/
  `border-*-color`/`box-shadow`（颜色统一成 `rgb()`）；
- 与初始值相同的样式项不落盘（初始值是规范常量，不是本机测量值）；
- 不记录任何字体度量派生量：`text-overflow`、`scrollHeight`、行数、文本宽度一概不取。

## 判失败的条件

| 类别     | 规则                                                      |
| -------- | --------------------------------------------------------- |
| 几何     | `x/y/width/height` 任一边差 > 1px                         |
| 长度样式 | `padding`/`margin`/`border-width`/字号等 px 值差 > 1px    |
| 颜色     | `rgb()` 三元组与 alpha 必须完全相等（零容差）             |
| 结构     | 元素数量、DOM 顺序、`tag`、class 签名、文本前缀任一不一致 |

## 环境与命令

```bash
pnpm test:layout:update   # 生成/更新基线（e2e/__layout__/<route>-<width>.json）
pnpm test:layout          # 对比（需要先 pnpm exec vite build，脚本自己拉起 vite preview）
pnpm test:layout:fonts    # 字体替换自检：font-family 换成 serif 后再采一次
node e2e/layout-snapshot.mjs --ignore-raster   # 去掉 --disable-lcd-text 等抗锯齿参数再比对（应仍零差异）
```

渲染参数与 `e2e/visual.mjs` 一致（stub-api + vite preview + 390/768/1280×900 + 关 LCD 次像素），
额外用 `--hide-scrollbars` 让滚动条不占布局，避免 Linux runner 的滚动条宽度改变盒子。

## 字体依赖的边界（重要）

颜色与字体完全无关；**几何对字体族有弱依赖**：文字宽度会渗进「宽度由内容撑开」的盒子
（flex-basis:auto、inline-block、`margin: auto` 的已用值）。`pnpm test:layout:fonts` 的实测结果：
15 个快照里 14 个零差异，只有 390px 目录页 23/188 个元素随字体族变化，最大 7px
（换成 serif 属于*故意换成度量不兼容的字族*，比跨机器的真实字体回退更苛刻）。

若 CI runner 与本地字体的**度量**不一致（例如 Arial ↔ Liberation Sans 之外的字族），
这类元素会出现同类差异，届时需要：在同一字体环境生成基线，或给测试注入固定字体。
