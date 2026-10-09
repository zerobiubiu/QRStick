/**
 * 状态层的形状与常量：状态仓、持久化、工单各段共用同一份定义。
 *
 * 放在这里而不是散在 `labelStore.ts` 里，是为了让 storage 与状态仓都能引用它们
 * 而不互相 import（避免形成环）；领域配置形状仍在 `lib/types.ts`。
 */
import type { ImageExportOptions, LabelConfig, PresetScope, PreviewColumns, PreviewLayout } from '../lib/types';
import type { DataFormat } from '../lib/importData';

/** 制作模式：单张 / 批量 */
export type AppMode = 'single' | 'batch';

/** 批量数据的来源信息（文件名、格式、编码、表头与提醒） */
export interface BatchMeta {
  fileName: string;
  format: DataFormat;
  encoding: 'utf-8' | 'gbk';
  hasHeader: boolean;
  warnings: string[];
}

/** 一次导出动作的状态（状态行与导出按钮都读它） */
export interface ExportRecord {
  phase: 'idle' | 'busy' | 'done';
  /** 正在做或刚做完的动作，用界面上的说法 */
  action: string;
  fileName: string;
  pages: number;
  at: string;
  /** 导出后要补的一句提醒（例如打印请设 100%） */
  note?: string;
  error?: string;
}

export const IDLE_EXPORT: ExportRecord = { phase: 'idle', action: '', fileName: '', pages: 0, at: '' };

/** 保存下来的一套参数 */
export interface LabelPreset {
  id: string;
  name: string;
  savedAt: string;
  /** full = 整套参数；style = 只存样式（标题格式 / 二维码参数 / 印刷标记 / 版式站位） */
  scope: PresetScope;
  config: LabelConfig;
}

/** 界面状态：不进导出、不进预设，只影响本机怎么看 */
export interface ViewState {
  previewLayout: PreviewLayout;
  previewZoom: number;
  previewColumns: PreviewColumns;
  splitRatio: number;
  columnWidths: Record<string, number>;
  imageExport: ImageExportOptions;
  /** 首访上手条是否已经被收起（用户点「知道了」，或第一次成功导出之后）——同一台机器不再出现 */
  onboardSeen: boolean;
}