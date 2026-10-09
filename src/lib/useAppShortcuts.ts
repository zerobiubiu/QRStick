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
}: {
  /** 键（event.key）→ 导出动作 */
  bindings: Record<string, TopAction>;
  onExport: (action: TopAction) => void;
  onToggleMode: () => void;
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
  }, [bindings, onExport, onToggleMode]);
}