/**
 * 导出的编排：把「顶栏按钮 / 快捷键」这一层与真正的导出管线（`export/run*.ts`）接起来，
 * 顺带负责导出记录的状态机（busy / done / 错误）、单飞锁（同一时刻只跑一次导出），
 * 以及「参数或批量数据一改，上一次已导出就不再成立」。
 *
 * 组件只拿 `handleExport` 与 `busy`，不再自己写 try/catch 与进度回填。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { EXPORT_ACTION, runExport, type ExportFormat } from '../export/run';
import { runImageExport } from '../export/runImage';
import type { BatchRow, ImageExportOptions, LabelConfig } from '../lib/types';
import { IDLE_EXPORT, type AppMode, type ExportRecord } from './types';

/** 顶栏三个动作：出片走图片导出（格式/模式可配），另两个是文档导出 */
export type TopAction = 'image' | 'pdf' | 'word';

/** 写入失败时的兜底句（浏览器下载权限是最常见的原因） */
const WRITE_FAILED = '无法写入下载文件，请检查浏览器的下载权限';

/** 导出记录里的失败说明：未出片的原因（原因文本里已带张数）；没有失败时返回 undefined，不占状态行 */
function failureText(failed: number, reasons: string[], unit: '张' | '页'): string | undefined {
  if (!failed) return undefined;
  return reasons.length ? reasons.join('；') : `${failed} ${unit}未出片`;
}

/**
 * 批量数据的紧凑指纹：只用于判断「数据有没有换过」，不保留原值。
 * 输出是定长串（与行数无关的量级），不会每渲染就对大表做一次全量 JSON.stringify。
 */
function rowsFingerprint(rows: BatchRow[]): string {
  let hash = 0x811c9dc5;
  for (const row of rows) {
    for (const text of [String(row.index), row.title, row.content]) {
      for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      hash = Math.imul(hash ^ 0x1f, 0x01000193); // 字段分隔，避免相邻字段拼出同一串
    }
  }
  return `${rows.length}:${(hash >>> 0).toString(36)}`;
}

export interface ExportActions {
  busy: boolean;
  handleExport: (action: TopAction) => Promise<void>;
}

export function useExportActions({
  mode,
  config,
  rows,
  pickedRows,
  selectedRow,
  imageExport,
  record,
  setRecord,
  imageLabel,
  imageModeLabel,
}: {
  mode: AppMode;
  config: LabelConfig;
  rows: BatchRow[];
  /** 多选命中的行；为空表示「全部」 */
  pickedRows: BatchRow[];
  selectedRow: number;
  imageExport: ImageExportOptions;
  record: ExportRecord;
  setRecord: Dispatch<SetStateAction<ExportRecord>>;
  /** 界面上的说法（例如「出片 PNG」），只用于导出记录与按钮文案 */
  imageLabel: string;
  imageModeLabel: string;
}): ExportActions {
  const [exportedKey, setExportedKey] = useState('');
  const configKey = useMemo(() => JSON.stringify(config), [config]);
  // 批量数据换过（导入 / 改字 / 增删行），上一次「已导出」同样不再成立
  const rowsKey = useMemo(() => rowsFingerprint(rows), [rows]);
  const exportKey = `${configKey}\u0000${rowsKey}`;
  // 同一时刻只允许一次导出：按钮有 disabled，快捷键与连点却绕得过去，第二道门设在这里
  const inFlight = useRef(false);

  // 导出记录不能挂在改过的参数上：参数一变，上一次「已导出」就不再成立
  useEffect(() => {
    if (record.phase === 'done' && exportedKey && exportedKey !== exportKey) setRecord(IDLE_EXPORT);
  }, [exportKey, exportedKey, record.phase, setRecord]);

  const handleImageExport = useCallback(async () => {
    const action = `${imageLabel}（${imageModeLabel}）`;
    setRecord({ ...IDLE_EXPORT, phase: 'busy', action });
    try {
      const result = await runImageExport({
        config,
        rows: mode === 'batch' ? rows : [],
        picked: mode === 'batch' ? pickedRows : [],
        options: imageExport,
        onProgress: (_done, total, note) =>
          setRecord((prev) => (prev.phase === 'busy' && total > 1 ? { ...prev, action: `${action} ${note}` } : prev)),
      });
      setRecord({
        phase: 'done',
        at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        action: result.action,
        fileName: result.fileName,
        pages: result.pages,
        error: failureText(result.failed, result.failureReasons, '张'),
      });
      setExportedKey(exportKey);
    } catch (cause) {
      setRecord({ ...IDLE_EXPORT, error: cause instanceof Error ? cause.message : WRITE_FAILED });
    }
  }, [config, exportKey, imageExport, imageLabel, imageModeLabel, mode, pickedRows, rows, setRecord]);

  const handleExport = useCallback(
    async (action: TopAction) => {
      if (inFlight.current) return; // 第二道门：按钮 disabled 之外，快捷键与连点都拦在这里
      inFlight.current = true;
      try {
        if (action === 'image') {
          await handleImageExport();
          return;
        }
        const format: ExportFormat = action;
        setRecord({ ...IDLE_EXPORT, phase: 'busy', action: EXPORT_ACTION[format] });
        try {
          const outcome = await runExport(
            { format, config, rows: mode === 'batch' ? (pickedRows.length ? pickedRows : rows) : [], selectedRow },
            (done, total) => {
              setRecord((prev) =>
                prev.phase === 'busy' && total > 1 ? { ...prev, action: `${EXPORT_ACTION[format]} ${done}/${total}` } : prev,
              );
            },
          );
          const { action: doneAction, fileName, pages, failed, failureReasons } = outcome;
          setRecord({
            phase: 'done',
            at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
            action: doneAction,
            fileName,
            pages,
            note: format === 'pdf' ? '打印请设 100%，关闭「适应页面」缩放' : undefined,
            error: failureText(failed, failureReasons, '页'),
          });
          setExportedKey(exportKey);
        } catch (cause) {
          setRecord({ ...IDLE_EXPORT, error: cause instanceof Error ? cause.message : WRITE_FAILED });
        }
      } finally {
        inFlight.current = false;
      }
    },
    [config, exportKey, handleImageExport, mode, pickedRows, rows, selectedRow, setRecord],
  );

  return { busy: record.phase === 'busy', handleExport };
}