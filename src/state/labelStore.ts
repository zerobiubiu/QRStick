/**
 * 状态仓：一份 LabelConfig（持久化到本机）、批量行、导出状态。
 *
 * 参数改动立刻重排印张——没有「应用」按钮，所以「待应用」这个状态在本产品里不存在；
 * 界面上的状态只有四种，全部用线型表达：已生效 / 正在出片 / 已导出 / 有提醒。
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { BatchRow, LabelConfig, MarksConfig, PageConfig, QrConfig, TitleConfig } from '../lib/types';

const STORAGE_KEY = 'qrstick.config.v1';

export const DEFAULT_CONFIG: LabelConfig = {
  page: {
    presetId: 'A4',
    widthMm: 210,
    heightMm: 297,
    landscape: false,
    dpi: 300,
    marginMm: 12,
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
  // 裁切标记默认打开：它是这个世界的签名器件，且标记本来就是印在纸上的东西；
  // 其余两个标记按需开（都会被印进导出件）
  marks: { cropMarks: true, colorBar: false, marginGuides: false },
};

export type AppMode = 'single' | 'batch';

export interface BatchMeta {
  fileName: string;
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
  error?: string;
}

export const IDLE_EXPORT: ExportRecord = { phase: 'idle', action: '', fileName: '', pages: 0, at: '' };

/** 读取本机存下的配置；形状对不上就退回默认，绝不把旧结构直接塞进界面 */
function loadConfig(): LabelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

export interface LabelStore {
  config: LabelConfig;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  rows: BatchRow[];
  setRows: (rows: BatchRow[]) => void;
  batch: BatchMeta | null;
  setBatch: (meta: BatchMeta | null) => void;
  selectedRow: number;
  setSelectedRow: (index: number) => void;
  record: ExportRecord;
  setRecord: Dispatch<SetStateAction<ExportRecord>>;
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
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [batch, setBatch] = useState<BatchMeta | null>(null);
  const [selectedRow, setSelectedRow] = useState(1);
  const [record, setRecord] = useState<ExportRecord>(IDLE_EXPORT);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* 隐私模式下写入会失败，不影响使用 */
    }
  }, [config]);

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

  return {
    config,
    mode,
    setMode,
    rows,
    setRows,
    batch,
    setBatch,
    selectedRow,
    setSelectedRow,
    record,
    setRecord,
    patchPage,
    patchQr,
    patchTitle,
    patchMarks,
    setContent,
    reset,
  };
}
