/**
 * 量一个元素的尺寸：挂载即量（回调 ref 同步量一次），ResizeObserver 负责后续变化。
 *
 * 两条兜底是实测出来的，不是防御性编码：
 *  - 0 尺寸一律忽略（切标签页、整页截图这类瞬时 0 高度不该把内容抹掉）；
 *  - ResizeObserver 在无头/隐身环境里可能不投递回调，所以另挂 window.resize 与一次 rAF 补量。
 */
import { useCallback, useRef, useState } from 'react';

export interface ElementSize {
  width: number;
  height: number;
}

/** 回调 ref 返回清理函数（React 19 支持），卸载时自动断开观察与监听 */
export function useElementSize(): { size: ElementSize; attach: (node: HTMLElement | null) => (() => void) | undefined } {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const observer = useRef<ResizeObserver | null>(null);

  const attach = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return undefined;

    const measure = () => {
      // 量内容框：clientWidth 含内边距，而内容只摆在内容框里——
      // 多量进内边距（例如印张台面的 44px）会让子内容溢出到容器外被裁掉
      const style = getComputedStyle(node);
      const width = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width > 0 && height > 0) {
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
      }
    };
    measure();
    const nextObserver = new ResizeObserver(measure);
    nextObserver.observe(node);
    observer.current = nextObserver;
    window.addEventListener('resize', measure);
    const frame = requestAnimationFrame(measure);

    return () => {
      nextObserver.disconnect();
      observer.current = null;
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(frame);
    };
  }, []);

  return { size, attach };
}