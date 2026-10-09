/**
 * 让出事件循环的两个小工具。
 *
 * 项目 lib 停在 ES2023，`Promise.withResolvers` 的类型还没进 lib，
 * 这里就地补一次形状（现代 Chromium 运行时本来就有这个方法）。
 */
interface WithResolvers {
  withResolvers<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void };
}

/** 让出一次事件循环：批量处理几十张图时，界面要能继续把进度画出来 */
export function yieldToPaint(): Promise<void> {
  const { promise, resolve } = (Promise as PromiseConstructor & WithResolvers).withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
}

/** 等待若干毫秒：连发下载需要节流，否则浏览器会拦 */
export function wait(ms: number): Promise<void> {
  const { promise, resolve } = (Promise as PromiseConstructor & WithResolvers).withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}