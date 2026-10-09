/**
 * 状态仓：一份 LabelConfig、批量数据行、导出状态、保存的预设。
 *
 * 全部落在本机 localStorage（纯前端、零上传）。配置、批量行、预设各占一个键，
 * 形状对不上就退回默认，绝不把旧结构直接塞进界面。
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  BatchRow,
  ImageExportOptions,
  LabelConfig,
  MarksConfig,
  PageConfig,
  PresetScope,
  PreviewColumns,
  PreviewLayout,
  QrConfig,
  StitchOptions,
  TitleConfig,
} from '../lib/types';
import type { DataFormat } from '../lib/importData';
import type { PresetFileEntry } from '../lib/presetFile';

const CONFIG_KEY = 'qrstick.config.v1';
const ROWS_KEY = 'qrstick.rows.v1';
const PRESETS_KEY = 'qrstick.presets.v1';
const VIEW_KEY = 'qrstick.view.v1';

/** 单张预览的缩放：1 = 适应窗口；大于 1 按倍数放大（容器内滚动，不裁切） */
export interface ViewState {
  previewLayout: PreviewLayout;
  previewZoom: number;
  previewColumns: PreviewColumns;
  splitRatio: number;
  columnWidths: Record<string, number>;
  imageExport: ImageExportOptions;
}

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

export type AppMode = 'single' | 'batch';

export interface BatchMeta {
  fileName: string;
  format: DataFormat;
  encoding: 'utf-8' | 'gbk';
  hasHeader: boolean;
  warnings: string[];
}

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

export interface LabelPreset {
  id: string;
  name: string;
  savedAt: string;
  /** full = 整套参数；style = 只存样式（标题格式 / 二维码参数 / 印刷标记 / 版式站位） */
  scope: PresetScope;
  config: LabelConfig;
}

export const IDLE_EXPORT: ExportRecord = { phase: 'idle', action: '', fileName: '', pages: 0, at: '' };

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

/** 本机唯一标识：不用 crypto.randomUUID（内网 http 下不可用） */
function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 拖拽排序后行号怎么变：被移动的那一行落到目标位，夹在中间的整段挤一位 */
function remapAfterMove(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (from > to && index >= to && index < from) return index + 1;
  return index;
}

export interface LabelStore {
  config: LabelConfig;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  rows: BatchRow[];
  setRows: (rows: BatchRow[]) => void;
  addRow: () => void;
  updateRow: (index: number, patch: Partial<Pick<BatchRow, 'title' | 'content'>>) => void;
  removeRow: (index: number) => void;
  /** 批量删除（确认对话框之后调用） */
  removeRows: (indexes: number[]) => void;
  /** 拖拽排序：数组位置（0 开始），内部按行身份搬移并重排序号 */
  moveRow: (from: number, to: number) => void;
  /** 多选：用于批量操作，与「当前预览行」分开 */
  selectedIds: number[];
  toggleSelected: (index: number) => void;
  setSelectedIds: (indexes: number[]) => void;
  /** 批量模式的预览排布（模式切换不丢） */
  previewLayout: PreviewLayout;
  setPreviewLayout: (layout: PreviewLayout) => void;
  /** 单张预览缩放：1 = 适应窗口，>1 放大并在区域内滚动 */
  previewZoom: number;
  setPreviewZoom: (zoom: number) => void;
  /** 多图网格每行几列 */
  previewColumns: PreviewColumns;
  setPreviewColumns: (columns: PreviewColumns) => void;
  /** 表格与预览的分栏比例（0.25–0.75），拖拽调整并持久化 */
  splitRatio: number;
  setSplitRatio: (ratio: number) => void;
  /** 表格列宽（持久化，手动拖拽调整） */
  columnWidths: Record<string, number>;
  setColumnWidths: (widths: Record<string, number>) => void;
  imageExport: ImageExportOptions;
  setImageExport: (next: Partial<Omit<ImageExportOptions, 'stitch'>> & { stitch?: Partial<StitchOptions> }) => void;
  batch: BatchMeta | null;
  setBatch: (meta: BatchMeta | null) => void;
  selectedRow: number;
  setSelectedRow: (index: number) => void;
  record: ExportRecord;
  setRecord: Dispatch<SetStateAction<ExportRecord>>;
  presets: LabelPreset[];
  savePreset: (name: string, scope: PresetScope) => void;
  applyPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  importPresets: (entries: PresetFileEntry[]) => { added: number; replaced: number };
  patchPage: (next: Partial<PageConfig>) => void;
  patchQr: (next: Partial<QrConfig>) => void;
  patchTitle: (next: Partial<TitleConfig>) => void;
  patchMarks: (next: Partial<MarksConfig>) => void;
  setContent: (content: string) => void;
  reset: () => void;
}

export function useLabelStore(): LabelStore {
  const [config, setConfig] = useState<LabelConfig>(loadConfig);
  const [mode, setMode] = useState<AppMode>('single');
  const [rows, setRows] = useState<BatchRow[]>(() => loadRows().rows);
  const [batch, setBatch] = useState<BatchMeta | null>(() => loadRows().batch);
  const [selectedRow, setSelectedRow] = useState(1);
  const [record, setRecord] = useState<ExportRecord>(IDLE_EXPORT);
  const [presets, setPresets] = useState<LabelPreset[]>(loadPresets);
  const [view, setView] = useState<ViewState>(loadView);
  const [selectedIds, setSelectedIdsState] = useState<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view));
    } catch {
      /* 隐私模式下写入会失败，不影响使用 */
    }
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch {
      /* 隐私模式下写入会失败，不影响使用 */
    }
  }, [config]);

  useEffect(() => {
    try {
      localStorage.setItem(ROWS_KEY, JSON.stringify({ rows, batch }));
    } catch {
      /* 同上 */
    }
  }, [rows, batch]);

  useEffect(() => {
    try {
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch {
      /* 同上 */
    }
  }, [presets]);

  const patchPage = useCallback((next: Partial<PageConfig>) => {
    setConfig((c) => ({ ...c, page: { ...c.page, ...next } }));
  }, []);
  const patchQr = useCallback((next: Partial<QrConfig>) => {
    setConfig((c) => ({ ...c, qr: { ...c.qr, ...next } }));
  }, []);
  const patchTitle = useCallback((next: Partial<TitleConfig>) => {
    setConfig((c) => ({ ...c, title: { ...c.title, ...next } }));
  }, []);
  const patchMarks = useCallback((next: Partial<MarksConfig>) => {
    setConfig((c) => ({ ...c, marks: { ...c.marks, ...next } }));
  }, []);
  const setContent = useCallback((content: string) => {
    setConfig((c) => ({ ...c, content }));
  }, []);
  const reset = useCallback(() => setConfig(DEFAULT_CONFIG), []);

  const addRow = useCallback(() => {
    const next = [...rows, { index: rows.length + 1, title: '', content: '' }];
    setRows(next);
    setSelectedRow(next.length);
  }, [rows]);

  const updateRow = useCallback((index: number, patch: Partial<Pick<BatchRow, 'title' | 'content'>>) => {
    setRows((prev) => prev.map((row) => (row.index === index ? { ...row, ...patch } : row)));
  }, []);

  /** 删除（单条 / 多条走同一条路）：重排序号，并让选中行落到最近的一行 */
  const removeRows = useCallback(
    (indexes: number[]) => {
      const targets = new Set(indexes);
      const next = rows.filter((row) => !targets.has(row.index)).map((row, i) => ({ ...row, index: i + 1 }));
      setRows(next);
      setSelectedIdsState((prev) => prev.filter((id) => !targets.has(id)));
      setSelectedRow((current) => {
        if (next.length === 0) return 1;
        if (targets.has(current)) return Math.min(Math.min(...indexes), next.length);
        // 被删的行在当前行之前 → 当前行整体前移
        return current - indexes.filter((id) => id < current).length;
      });
    },
    [rows],
  );
  const removeRow = useCallback((index: number) => removeRows([index]), [removeRows]);

  /** 拖拽排序：from/to 是数组位置（0 开始）；按行身份搬移，行号整体重排 */
  const moveRow = useCallback(
    (from: number, to: number) => {
      const count = rows.length;
      if (count === 0 || from === to || from < 0 || from >= count) return;
      const target = Math.max(0, Math.min(to, count - 1));
      const moved = rows[from];
      const next = [...rows];
      next.splice(from, 1);
      next.splice(target, 0, moved);
      setRows(next.map((row, i) => ({ ...row, index: i + 1 })));
      // 选中行与多选都要跟着搬位置，否则索引会指向别人
      setSelectedRow((current) => remapAfterMove(current - 1, from, target) + 1);
      setSelectedIdsState((prev) => prev.map((id) => remapAfterMove(id - 1, from, target) + 1).sort((a, b) => a - b));
    },
    [rows],
  );

  const toggleSelected = useCallback((index: number) => {
    setSelectedIdsState((prev) =>
      prev.includes(index) ? prev.filter((id) => id !== index) : [...prev, index].sort((a, b) => a - b),
    );
  }, []);
  const setSelectedIds = useCallback((indexes: number[]) => {
    setSelectedIdsState([...new Set(indexes)].sort((a, b) => a - b));
  }, []);

  const setPreviewLayout = useCallback((previewLayout: PreviewLayout) => setView((v) => ({ ...v, previewLayout })), []);
  const setPreviewZoom = useCallback(
    (previewZoom: number) => setView((v) => ({ ...v, previewZoom: Math.min(3, Math.max(1, previewZoom)) })),
    [],
  );
  const setPreviewColumns = useCallback(
    (previewColumns: PreviewColumns) => setView((v) => ({ ...v, previewColumns })),
    [],
  );
  const setSplitRatio = useCallback(
    (splitRatio: number) => setView((v) => ({ ...v, splitRatio: Math.min(0.75, Math.max(0.25, splitRatio)) })),
    [],
  );
  const setColumnWidths = useCallback((columnWidths: Record<string, number>) => setView((v) => ({ ...v, columnWidths })), []);
  const setImageExport = useCallback(
    (next: Partial<Omit<ImageExportOptions, 'stitch'>> & { stitch?: Partial<StitchOptions> }) =>
      setView((v) => ({
        ...v,
        imageExport: { ...v.imageExport, ...next, stitch: { ...v.imageExport.stitch, ...next.stitch } },
      })),
    [],
  );

  const savePreset = useCallback(
    (name: string, scope: PresetScope) => {
      const preset: LabelPreset = {
        id: makeId(),
        name: name.trim() || `预设 ${presets.length + 1}`,
        savedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        scope,
        config: structuredClone(config),
      };
      setPresets((prev) => [preset, ...prev]);
    },
    [config, presets.length],
  );
  // 样式预设只覆盖样式四件套，纸张与页边距保持当前值——这样「同一套标题样式」能贴到不同尺寸的标签上
  const applyPreset = useCallback(
    (id: string) => {
      const preset = presets.find((item) => item.id === id);
      if (!preset) return;
      if (preset.scope === 'style') {
        setConfig((current) => ({
          ...current,
          title: { ...preset.config.title },
          qr: { ...preset.config.qr },
          marks: { ...preset.config.marks },
          page: { ...current.page, blockAlign: preset.config.page.blockAlign },
        }));
        return;
      }
      setConfig(structuredClone(preset.config));
    },
    [presets],
  );
  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((item) => item.id !== id));
  }, []);

  /** 导入预设：同名覆盖、否则插到最前；缺字段按默认值补齐，绝不把半截结构塞进界面 */
  const importPresets = useCallback(
    (entries: PresetFileEntry[]) => {
      const next = [...presets];
      let added = 0;
      let replaced = 0;
      for (const entry of entries) {
        const merged: LabelConfig = {
          page: { ...DEFAULT_CONFIG.page, ...entry.config.page },
          qr: { ...DEFAULT_CONFIG.qr, ...entry.config.qr },
          title: { ...DEFAULT_CONFIG.title, ...entry.config.title },
          marks: { ...DEFAULT_CONFIG.marks, ...entry.config.marks },
          content: typeof entry.config.content === 'string' ? entry.config.content : DEFAULT_CONFIG.content,
        };
        const preset: LabelPreset = {
          id: makeId(),
          name: entry.name,
          savedAt: entry.savedAt || new Date().toLocaleString('zh-CN', { hour12: false }),
          scope: entry.scope,
          config: merged,
        };
        const existing = next.findIndex((item) => item.name === entry.name);
        if (existing >= 0) {
          next[existing] = preset;
          replaced += 1;
        } else {
          next.unshift(preset);
          added += 1;
        }
      }
      setPresets(next);
      return { added, replaced };
    },
    [presets],
  );

  return {
    config,
    mode,
    setMode,
    rows,
    setRows,
    addRow,
    updateRow,
    removeRow,
    removeRows,
    moveRow,
    selectedIds,
    toggleSelected,
    setSelectedIds,
    previewLayout: view.previewLayout,
    setPreviewLayout,
    previewZoom: view.previewZoom,
    setPreviewZoom,
    previewColumns: view.previewColumns,
    setPreviewColumns,
    splitRatio: view.splitRatio,
    setSplitRatio,
    columnWidths: view.columnWidths,
    setColumnWidths,
    imageExport: view.imageExport,
    setImageExport,
    batch,
    setBatch,
    selectedRow,
    setSelectedRow,
    record,
    setRecord,
    presets,
    savePreset,
    applyPreset,
    deletePreset,
    importPresets,
    patchPage,
    patchQr,
    patchTitle,
    patchMarks,
    setContent,
    reset,
  };
}