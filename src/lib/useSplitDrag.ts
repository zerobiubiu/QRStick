/**
 * 拖动分隔条改分栏比例：只负责指针事件与几何换算（比例 = 指针相对容器左侧的位置），
 * 比例存哪里、怎么钳制由调用方决定。
 *
 * 拖拽期间把光标锁成 col-resize，松手时无论指针在哪里都一定解绑。
 */
import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export function useSplitDrag(onRatio: (ratio: number) => void): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  startDrag: (event: ReactPointerEvent) => void;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const startDrag = useCallback(
    (event: ReactPointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const onMove = (moveEvent: PointerEvent) => onRatio((moveEvent.clientX - rect.left) / rect.width);
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        document.body.style.cursor = '';
      };
      document.body.style.cursor = 'col-resize';
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onRatio],
  );

  return { containerRef, startDrag };
}