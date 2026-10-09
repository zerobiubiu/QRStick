/**
 * 导出的编排：把「顶栏按钮 / 快捷键」这一层与真正的导出管线（`export/run*.ts`）接起来，
 * 顺带负责导出记录的状态机（busy / done / 错误）与「参数一改，上一次已导出就不再成立」。
 *
 * 组件只拿 `handleExport` 与 `busy`，不再自己写 try/catch 与进度回填。
 */
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { EXPORT_ACTION, runExport, type ExportFormat } from '../export/run';
import { runImageExport } from '../export/runImage';
import type { BatchRow, ImageExportOptions, LabelConfig } from '../lib/types';
import { IDLE_EXPORT, type AppMode, type ExportRecord } from './types';

/** 顶栏三个动作：出片走图片导出（格式/模式可配），另两个是文档导出 */
export type TopAction = 'image' | 'pdf' | 'word';

/** 写入失败时的兜底句（浏览器下载权限是最常见的原因） */
const WRITE_FAILED = '无法写入下载文件，请检查浏览器的下载权限';

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

  // 导出记录不能挂在改过的参数上：参数一变，上一次「已导出」就不再成立
  useEffect(() => {
    if (record.phase === 'done' && exportedKey && exportedKey !== configKey) setRecord(IDLE_EXPORT);
  }, [configKey, exportedKey, record.phase, setRecord]);

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
        note: result.failed.length ? `${result.failed.length} 张失败：${result.failed[0]}` : undefined,
      });
      setExportedKey(configKey);
    } catch (cause) {
      setRecord({ ...IDLE_EXPORT, error: cause instanceof Error ? cause.message : WRITE_FAILED });
    }
  }, [config, configKey, imageExport, imageLabel, imageModeLabel, mode, pickedRows, rows, setRecord]);

  const handleExport = useCallback(
    async (action: TopAction) => {
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
        setRecord({
          phase: 'done',
          at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          note: format === 'pdf' ? '打印请设 100%，关闭「适应页面」缩放' : undefined,
          ...outcome,
        });
        setExportedKey(configKey);
      } catch (cause) {
        setRecord({ ...IDLE_EXPORT, error: cause instanceof Error ? cause.message : WRITE_FAILED });
      }
    },
    [config, configKey, handleImageExport, mode, pickedRows, rows, selectedRow, setRecord],
  );

  return { busy: record.phase === 'busy', handleExport };
}