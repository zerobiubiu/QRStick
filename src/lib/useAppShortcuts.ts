/**
 * 顶栏快捷键：Alt+数字触发导出动作、Alt+M 切换制作模式。
 *
 * 在输入框里打字时不抢键（否则在标题里按 Alt+M 会切模式）；
 * 动作表由调用方传入，避免「按哪几个键」这件事在界面与这里各写一份。
 */
import { useEffect } from 'react';
import type { TopAction } from '../state/useExportActions';

export function useAppShortcuts({
  bindings,
  onExport,
  onToggleMode,
  enabled = true,
}: {
  /** 键（event.key）→ 导出动作 */
  bindings: Record<string, TopAction>;
  onExport: (action: TopAction) => void;
  onToggleMode: () => void;
  /** 导出此刻能不能触发（导出中 / 批量模式没有数据时为 false）；快捷键不能绕过按钮的 disabled */
  enabled?: boolean;
}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const action = bindings[event.key];
      if (action) {
        event.preventDefault();
        if (!enabled) return; // 按钮此时是灰的，键盘也不该另开一扇门
        void onExport(action);
        return;
      }
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        onToggleMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bindings, enabled, onExport, onToggleMode]);
}