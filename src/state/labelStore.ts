/**
 * 状态仓：一份 LabelConfig、批量数据行、导出状态、保存的预设。
 *
 * 全部落在本机 localStorage（纯前端、零上传）。配置、批量行、预设各占一个键，
 * 形状对不上就退回默认，绝不把旧结构直接塞进界面。
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { BatchRow, LabelConfig, MarksConfig, PageConfig, PresetScope, QrConfig, TitleConfig } from '../lib/types';
import type { DataFormat } from '../lib/importData';
import type { PresetFileEntry } from '../lib/presetFile';

const CONFIG_KEY = 'qrstick.config.v1';
const ROWS_KEY = 'qrstick.rows.v1';
const PRESETS_KEY = 'qrstick.presets.v1';

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

export interface LabelStore {
  config: LabelConfig;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  rows: BatchRow[];
  setRows: (rows: BatchRow[]) => void;
  addRow: () => void;
  updateRow: (index: number, patch: Partial<Pick<BatchRow, 'title' | 'content'>>) => void;
  removeRow: (index: number) => void;
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
    setRows((prev) => {
      const next = [...prev, { index: prev.length + 1, title: '', content: '' }];
      setSelectedRow(next.length);
      return next;
    });
  }, []);

  const updateRow = useCallback((index: number, patch: Partial<Pick<BatchRow, 'title' | 'content'>>) => {
    setRows((prev) => prev.map((row) => (row.index === index ? { ...row, ...patch } : row)));
  }, []);

  const removeRow = useCallback(
    (index: number) => {
      const next = rows.filter((row) => row.index !== index).map((row, i) => ({ ...row, index: i + 1 }));
      setRows(next);
      setSelectedRow((current) => {
        if (next.length === 0) return 1;
        if (current === index) return Math.min(index, next.length);
        return current > index ? current - 1 : current;
      });
    },
    [rows],
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