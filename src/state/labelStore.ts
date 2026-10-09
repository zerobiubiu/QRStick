/**
 * 状态仓：一份 LabelConfig、批量数据行、导出状态、保存的预设。
 *
 * 全部落在本机 localStorage（纯前端、零上传）。配置、批量行、预设各占一个键，
 * 形状对不上就退回默认，绝不把旧结构直接塞进界面。
 */
import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
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
import type { PresetFileEntry } from '../lib/presetFile';
import { CONFIG_KEY, DEFAULT_CONFIG, PRESETS_KEY, ROWS_KEY, VIEW_KEY, loadInitialState, usePersisted } from './persistence';
import { IDLE_EXPORT, type AppMode, type BatchMeta, type ExportRecord, type LabelPreset, type ViewState } from './types';

/* 四个本机键、默认值、读取与写入都在 `state/persistence.ts`（全项目唯一碰 localStorage 的地方）；
   状态形状（AppMode / BatchMeta / ExportRecord / LabelPreset / ViewState）在 `state/types.ts`。 */

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
  /** 整批替换批量行（导入 / 清空）：越界的多选会被丢弃，免得导出侧命中已经不存在的行 */
  setRows: (rows: BatchRow[]) => void;
  /** 批量行写入本机存储失败的人话原因（空串 = 正常）；由数据源区就地提示 */
  rowsStorageError: string;
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
  // 本机四键一次读齐：形状对不上的兜底规则在 state/persistence.ts
  const [initial] = useState(loadInitialState);
  const [config, setConfig] = useState<LabelConfig>(initial.config);
  const [mode, setMode] = useState<AppMode>('single');
  const [rows, setRowsState] = useState<BatchRow[]>(initial.rows);
  const [batch, setBatch] = useState<BatchMeta | null>(initial.batch);
  const [selectedRow, setSelectedRow] = useState(1);
  const [record, setRecord] = useState<ExportRecord>(IDLE_EXPORT);
  const [presets, setPresets] = useState<LabelPreset[]>(initial.presets);
  const [view, setView] = useState<ViewState>(initial.view);
  const [selectedIds, setSelectedIdsState] = useState<number[]>([]);

  // 四份状态各自落本机：写入失败（隐私模式 / 配额满）不影响使用，但会经 rowsStorageError 报给界面
  usePersisted(VIEW_KEY, view);
  usePersisted(CONFIG_KEY, config);
  // 批量行可能上千条，且行内编辑每个按键都变：整份序列化去抖，避免打字卡顿
  const rowsSnapshot = useMemo(() => ({ rows, batch }), [rows, batch]);
  const { failedReason: rowsStorageError } = usePersisted(ROWS_KEY, rowsSnapshot, { debounceMs: 400 });
  usePersisted(PRESETS_KEY, presets);

  /** 整批替换批量行：顺手丢掉越界的多选，绝不让选中项指向已不存在的行 */
  const setRows = useCallback((next: BatchRow[]) => {
    setRowsState(next);
    const alive = new Set(next.map((row) => row.index));
    setSelectedIdsState((prev) => {
      const kept = prev.filter((id) => alive.has(id));
      return kept.length === prev.length ? prev : kept;
    });
  }, []);

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
    setRowsState(next);
    setSelectedRow(next.length);
  }, [rows]);

  const updateRow = useCallback((index: number, patch: Partial<Pick<BatchRow, 'title' | 'content'>>) => {
    setRowsState((prev) => prev.map((row) => (row.index === index ? { ...row, ...patch } : row)));
  }, []);

  /** 删除（单条 / 多条走同一条路）：重排序号，并让选中行落到最近的一行 */
  const removeRows = useCallback(
    (indexes: number[]) => {
      const targets = new Set(indexes);
      const next = rows.filter((row) => !targets.has(row.index)).map((row, i) => ({ ...row, index: i + 1 }));
      setRowsState(next);
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
      setRowsState(next.map((row, i) => ({ ...row, index: i + 1 })));
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
    rowsStorageError,
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