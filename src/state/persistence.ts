/**
 * 本机持久化：全项目**唯一**碰 localStorage 的地方。
 *
 * 四个键各存一类状态（配置 / 批量行 / 样式预设 / 界面状态），读的时候一律
 * 「形状对不上就退回默认值」，绝不把旧结构或半截结构塞进界面；写入失败
 * （隐私模式）只影响持久化，不影响使用。
 *
 * 状态仓 `labelStore.ts` 只负责状态与动作，不再直接读写存储。
 */
import { useEffect } from 'react';
import type { BatchRow, ImageExportOptions, LabelConfig, PreviewColumns } from '../lib/types';
import type { BatchMeta, LabelPreset, ViewState } from './types';

/** 本机四个键；每个键自带版本后缀，结构变了就换后缀，不写迁移代码 */
export const CONFIG_KEY = 'qrstick.config.v1';
export const ROWS_KEY = 'qrstick.rows.v1';
export const PRESETS_KEY = 'qrstick.presets.v1';
export const VIEW_KEY = 'qrstick.view.v1';

export const DEFAULT_VIEW: ViewState = {
  previewLayout: 'grid',
  previewZoom: 1,
  previewColumns: 'auto',
  splitRatio: 0.5,
  columnWidths: { index: 64, title: 190, content: 240, select: 44, handle: 40, actions: 40 },
  imageExport: {
    format: 'png',
    quality: 0.92,
    background: '#ffffff',
    // 批量默认打包：逐张下载会被浏览器拦，打包是一个动作一个文件
    mode: 'zip',
    stitch: { placement: 'grid', columns: 3, gapMm: 2, captions: false },
  },
};

export const DEFAULT_CONFIG: LabelConfig = {
  page: {
    presetId: 'A4',
    widthMm: 210,
    heightMm: 297,
    landscape: false,
    dpi: 300,
    marginMm: 12,
    blockAlign: 'center',
  },
  qr: { sizeMm: 60, errorCorrectionLevel: 'M', quietZoneModules: 4 },
  title: {
    text: '库位 A-03-12',
    fontId: 'hei',
    fontSizePt: 32,
    bold: true,
    align: 'center',
    position: 'above',
    gapMm: 8,
    lineHeight: 1.25,
  },
  content: 'LOC-A-03-12',
  // 裁切标记与色标条默认打开：标记本来就该印在纸上，色标条还能在纸上自证尺寸
  marks: { cropMarks: true, colorBar: true, marginGuides: false },
};

function loadView(): ViewState {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (!raw) return DEFAULT_VIEW;
    const saved = JSON.parse(raw) as Partial<ViewState>;
    return {
      previewLayout: saved.previewLayout === 'single' ? 'single' : 'grid',
      previewZoom: typeof saved.previewZoom === 'number' && saved.previewZoom >= 1 ? Math.min(3, saved.previewZoom) : 1,
      previewColumns: ['auto', 2, 3, 4, 5].includes(saved.previewColumns as never) ? (saved.previewColumns as PreviewColumns) : 'auto',
      splitRatio: typeof saved.splitRatio === 'number' ? Math.min(0.75, Math.max(0.25, saved.splitRatio)) : DEFAULT_VIEW.splitRatio,
      columnWidths: { ...DEFAULT_VIEW.columnWidths, ...saved.columnWidths },
      imageExport: {
        ...DEFAULT_VIEW.imageExport,
        ...saved.imageExport,
        stitch: { ...DEFAULT_VIEW.imageExport.stitch, ...saved.imageExport?.stitch },
      },
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

/** 老配置里没有的字段一律回落到默认值（例如后来才加的 blockAlign） */
function loadConfig(): LabelConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const saved = JSON.parse(raw) as Partial<LabelConfig>;
    return {
      page: { ...DEFAULT_CONFIG.page, ...saved.page },
      qr: { ...DEFAULT_CONFIG.qr, ...saved.qr },
      title: { ...DEFAULT_CONFIG.title, ...saved.title },
      marks: { ...DEFAULT_CONFIG.marks, ...saved.marks },
      content: typeof saved.content === 'string' ? saved.content : DEFAULT_CONFIG.content,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadRows(): { rows: BatchRow[]; batch: BatchMeta | null } {
  try {
    const raw = localStorage.getItem(ROWS_KEY);
    if (!raw) return { rows: [], batch: null };
    const saved = JSON.parse(raw) as { rows?: BatchRow[]; batch?: BatchMeta | null };
    const rows = Array.isArray(saved.rows)
      ? saved.rows
          .filter((row) => typeof row?.content === 'string')
          .map((row, i) => ({ index: i + 1, title: String(row.title ?? ''), content: String(row.content) }))
      : [];
    return { rows, batch: saved.batch ?? null };
  } catch {
    return { rows: [], batch: null };
  }
}

function loadPresets(): LabelPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const saved = JSON.parse(raw) as LabelPreset[];
    return Array.isArray(saved)
      ? saved
          .filter((preset) => preset?.id && preset?.config)
          .map((preset) => ({ ...preset, scope: preset.scope === 'style' ? 'style' : 'full' }))
      : [];
  } catch {
    return [];
  }
}

/** 四份本机状态的初始值：一次读齐，避免每个键各解析一遍 */
export function loadInitialState(): {
  config: LabelConfig;
  rows: BatchRow[];
  batch: BatchMeta | null;
  presets: LabelPreset[];
  view: ViewState;
} {
  const { rows, batch } = loadRows();
  return { config: loadConfig(), rows, batch, presets: loadPresets(), view: loadView() };
}

/**
 * 把一份状态挂到某个本机键上：状态一变就写入。
 * 四个键共用这一个实现，不再每个键抄一遍带 try/catch 的 effect。
 */
export function usePersisted<T>(key: string, value: T): void {
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 隐私模式下写入会失败，不影响使用 */
    }
  }, [key, value]);
}

/** 供测试或排障读取一份原始值（解析与兜底仍走上面的 loader） */
export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export type { ImageExportOptions };