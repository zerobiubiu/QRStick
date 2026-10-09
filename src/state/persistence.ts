/**
 * 本机持久化：全项目**唯一**碰 localStorage 的地方。
 *
 * 四个键各存一类状态（配置 / 批量行 / 样式预设 / 界面状态），读的时候一律
 * 「形状对不上就退回默认值」，绝不把旧结构或半截结构塞进界面；写入失败
 * （隐私模式 / 配额满）不影响继续使用，但会**如实回报给界面**，绝不静默吞掉——
 * 否则用户会以为「改动已自动保存」。
 *
 * 状态仓 `labelStore.ts` 只负责状态与动作，不再直接读写存储。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
  onboardSeen: false,
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
      // 只有明确存过 true 才算收过：老配置（没这个字段）保持「未收」，老用户也能看到一次首访条
      onboardSeen: saved.onboardSeen === true,
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

/** 写入失败的人话原因：隐私模式与配额满是最常见的两种 */
function describeWriteFailure(cause: unknown): string {
  const name = cause instanceof DOMException ? cause.name : '';
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return '本机存储空间已满';
  if (name === 'SecurityError') return '浏览器禁用了本机存储（隐私模式或站点设置）';
  return '浏览器拒绝了这次写入';
}

/** 一次挂载的写入状态：失败原因由界面就地说明，空串表示一直写得好好的 */
export interface PersistStatus {
  failedReason: string;
}

export interface PersistOptions {
  /** 写入去抖毫秒数：值很大又改得频繁（例如上千行数据）时用，0 = 每次改动立即写 */
  debounceMs?: number;
}

/**
 * 把一份状态挂到某个本机键上：状态一变就写入，并回报是否写得进去。
 * 四个键共用这一个实现，不再每个键抄一遍带 try/catch 的 effect。
 *
 * 去抖只按需开启（批量行用）：界面状态（配置 / 视图 / 预设）仍然即时写，
 * 不牺牲「改一下就记住」的手感；待写值放 ref，卸载或换 key 前会 flush，
 * 去抖窗口里的最后一次改动不会丢。
 */
export function usePersisted<T>(key: string, value: T, { debounceMs = 0 }: PersistOptions = {}): PersistStatus {
  const [failedReason, setFailedReason] = useState('');
  const pendingRef = useRef<{ key: string; value: T } | null>(null);
  const timerRef = useRef<number | null>(null);

  const write = useCallback((pending: { key: string; value: T } | null) => {
    if (!pending) return;
    try {
      localStorage.setItem(pending.key, JSON.stringify(pending.value));
      setFailedReason((prev) => (prev ? '' : prev)); // 恢复后不留旧提示；同值更新会被 React 跳过
    } catch (cause) {
      setFailedReason(describeWriteFailure(cause));
    }
  }, []);

  useEffect(() => {
    pendingRef.current = { key, value };
    if (debounceMs > 0) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        write(pending);
      }, debounceMs);
      return () => {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    write(pending);
  }, [key, value, debounceMs, write]);

  // 卸载前的最后一写：去抖窗口里还没落盘的值不能丢（卸载路径没地方报错，交给界面上已有的失败提示）
  useEffect(
    () => () => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (!pending) return;
      try {
        localStorage.setItem(pending.key, JSON.stringify(pending.value));
      } catch {
        /* 卸载中无法再更新状态；界面此前的失败提示已说明存储不可用 */
      }
    },
    [],
  );

  return { failedReason };
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