# 架构说明

| 文档 | 状态 | 内容 |
| --- | --- | --- |
| [0001-渲染核与导出链路.md](0001-渲染核与导出链路.md) | 已执行 | 毫米 → 像素 → 文件的唯一链路；批量出码的内存策略 |

阅读顺序：先 `0001`，再看源码 `src/lib/render.ts` → `src/lib/export.ts` → `src/export/run.ts`。

相关代码/配置：`src/lib/{units,types,fonts,render,export,exportImage,download,importData,presetFile,batch,preview,async,useElementSize}.ts`、`src/export/{run,runImage}.ts`、`src/state/labelStore.ts`（本机四个键：`qrstick.config.v1` 配置、`qrstick.rows.v1` 批量行、`qrstick.presets.v1` 样式预设、`qrstick.view.v1` 界面状态）。

界面层：`src/components/{PressSheet,Docket,BatchSource,BatchTable,BatchPreviewGrid,ConfirmDialog,StateLine}.tsx`（批量表用 MUI Table + dnd-kit，预览网格用懒渲染画布）。

废弃与替代：无。
