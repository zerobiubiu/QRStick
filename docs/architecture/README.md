# 架构说明

| 文档 | 状态 | 内容 |
| --- | --- | --- |
| [0001-渲染核与导出链路.md](0001-渲染核与导出链路.md) | 已执行 | 毫米 → 像素 → 文件的唯一链路；批量出码的内存策略 |

阅读顺序：先 `0001`，再看源码 `src/lib/render.ts` → `src/lib/export.ts` → `src/export/run.ts`。

相关代码/配置：`src/lib/{units,types,fonts,render,export,download,importData,presetFile,batch}.ts`、`src/export/run.ts`、`src/state/labelStore.ts`（本机三个键：`qrstick.config.v1` 配置、`qrstick.rows.v1` 批量行、`qrstick.presets.v1` 样式预设）。

废弃与替代：无。
