/**
 * 样式预设的文件导入导出：把「选文件 → 读 → 解析 → 写回状态」和
 * 「从状态拼文件 → 下载」这两段副作用从工单组件里拿出来。
 *
 * 纯逻辑（信封格式、宽容解析）在 `lib/presetFile.ts`；这里只负责浏览器侧的动作
 * 与一行就地提示。工单段只渲染按钮，不再自己碰 Blob / FileReader / input 元素。
 */
import { useCallback, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { saveBlob, sanitizeFileName } from '../lib/download';
import { buildPresetFile, parsePresetFile, type PresetFileEntry } from '../lib/presetFile';
import type { LabelPreset } from './types';

export interface PresetTransfer {
  /** 一行就地提示（导入/导出的结果或原因），没话说时是空串 */
  notice: string;
  /** 就地写一行提示（例如保存成功后） */
  notify: (text: string) => void;
  /** 隐藏的 file input，挂到页面上由 openPicker 触发 */
  inputRef: RefObject<HTMLInputElement | null>;
  openPicker: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** 把当前所有预设导出成一个 JSON 文件 */
  exportFile: () => void;
}

export function usePresetTransfer({
  presets,
  importPresets,
}: {
  presets: LabelPreset[];
  importPresets: (entries: PresetFileEntry[]) => { added: number; replaced: number };
}): PresetTransfer {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState('');

  const exportFile = useCallback(() => {
    if (!presets.length) {
      setNotice('还没有预设可导出：先存一套。');
      return;
    }
    const entries = presets.map(({ name, scope, savedAt, config }) => ({ name, scope, savedAt, config }));
    saveBlob(
      new Blob([buildPresetFile(entries)], { type: 'application/json;charset=utf-8' }),
      `${sanitizeFileName('qrstick-预设')}.json`,
    );
    setNotice(`已导出 ${entries.length} 套预设（JSON，可带到别的机器导入）`);
  }, [presets]);

  const onFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      void (async () => {
        try {
          const parsed = parsePresetFile(await file.text());
          const { added, replaced } = importPresets(parsed.entries);
          const parts = [`导入 ${added + replaced} 套（新增 ${added}、覆盖 ${replaced}）`];
          if (parsed.warnings.length) parts.push(`${parsed.warnings.length} 条提醒：${parsed.warnings[0]}`);
          setNotice(parts.join('；'));
        } catch (cause) {
          setNotice(cause instanceof Error ? `导入失败：${cause.message}` : '导入失败');
        }
      })();
    },
    [importPresets],
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return { notice, notify: setNotice, inputRef, openPicker, onFileChange, exportFile };
}