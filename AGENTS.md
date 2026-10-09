# QRStick 项目规则（agent 执行）

本文件只写**执行规则**；说明、记录、分析一律进 `docs/`。

## 技术栈

- Vite + React + MUI（含 MUI X）+ TypeScript，纯前端静态站，**无后端**。
- 组件优先用 MUI / MUI X；不引第三方 UI 库；不引网络字体（现场常离线，字体走系统字体栈）。
- 数据不出浏览器：任何新增功能都不得引入上传、埋点、外部接口。

## 包管理与命令

- 包管理器一律 **bun**：`bun install`、`bun add <pkg>`、`bun run dev|build|lint|preview`；一次性 CLI 用 `bunx`。**禁止 npm / npx**，仓库只保留 `bun.lock`。
- 验证顺序：`bunx tsc -b` → `bun run build` → 起本地服务用浏览器真跑一遍（预览 / 三种导出 / 批量）。
- 部署目标：阿里云 ESA Pages 静态托管，构建产物 `dist/`，根路径发布（`base: '/'`）。

## Git

- 一个逻辑变更一个提交；提交信息用简体中文，写清「做了什么、为什么」。
- 未经要求不提交、不推送、不切分支、不 rebase、不改写历史。
- 不提交密钥/凭据、构建产物、依赖目录、`.impeccable/` 过程产物。
- 首个提交前扫一遍 diff 与文件树，确认没有凭据。

## 项目版本

- 单一事实来源：`package.json` 的 `version`；变更同步写 `CHANGELOG.md`。
- 只在**被发布程序的行为变更**时递增：破坏性 → major，兼容新功能 → minor，兼容修复 → patch。
- 纯文档、注释、`AGENTS.md` 改动**不**递增版本。

## 代码

- 注释与用户可见文案用**简体中文**。
- 毫米是版面真相，像素是导出真相；尺寸换算只在 `src/lib/units.ts`，不引入隐式换算。
- `src/lib/render.ts` 是预览与导出的**唯一渲染源**：不要在别处再画一遍标签；新增导出格式必须复用同一条链路。
- 二维码按整数像素/模块落地，禁止对二维码整体缩放。

## 文档

- 文档集中在 `docs/`，入口 `docs/README.md`（索引 + 规范 + 要求）。
- 改动源码必须随行写 `docs/changes/`；新增文档回 `docs/README.md` 补索引。
- 根目录 `PRODUCT.md` 是产品与用户上下文记录（impeccable 使用），改动前先问用户。
