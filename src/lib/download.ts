/**
 * 下载叶子模块：Blob → 浏览器下载、画布 → PNG、文件名清洗。
 *
 * 不依赖界面与渲染核，export.ts 与界面层共用这里；文件名只清洗主体，
 * 扩展名（.png / .pdf / .docx）由调用方自己拼。
 */

/** 触发一次浏览器下载：a 标签 + objectURL，点完立刻回收 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  // 少数浏览器要求链接在文档里才会响应 click
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // 下载已经启动，objectURL 不再需要，立刻回收避免整页内存泄漏
  URL.revokeObjectURL(url);
}

/** 画布 → PNG Blob；toBlob 回空表示拿不到像素（画布被跨域内容污染等） */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  // 项目 lib 停在 ES2023，`Promise.withResolvers` 的类型还没进 lib；运行时（现代 Chromium）本来就有
  const promiseCtor = Promise as PromiseConstructor & {
    withResolvers<T>(): {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  const { promise, resolve, reject } = promiseCtor.withResolvers<Blob>();
  canvas.toBlob((blob) => {
    if (blob) {
      resolve(blob);
    } else {
      reject(new Error('画布导出 PNG 失败：toBlob 返回空'));
    }
  }, 'image/png');
  return promise;
}

/**
 * 文件名清洗：去掉 Windows 非法字符与控制符（中文保留），去掉首尾空白与结尾的点，
 * 按字符截断到 60，空则回退 'label'。
 */
export function sanitizeFileName(text: string): string {
  const base = Array.from(
    text
      .replace(/[\\/:*?"<>|]/g, '') // Windows 非法字符
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // 控制符
      .trim(), // 首尾空白
  )
    // 按码点截断，避免在代理对中间切开
    .slice(0, 60)
    .join('')
    .replace(/[\s.]+$/, ''); // 截断后可能又露出结尾的空白或点
  return base || 'label';
}
