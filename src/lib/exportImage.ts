/**
 * 图片导出：逐张保存 / ZIP 打包 / 拼接成一张，PNG 与 JPEG 两种格式。
 *
 * 三条纪律（都是实测踩过的）：
 *  - **不改调用方的画布**：JPEG 没有透明通道，需要在副本上铺背景色再编码，原画布必须原样不动；
 *  - **不卡界面、不丢张**：每处理一页让出一次事件循环并报进度；逐张模式两张之间节流，
 *    避免浏览器把连发下载当成恶意行为拦掉；单张失败只记进失败清单，不中断整批；
 *  - **不覆盖**：文件名一律「序号-标题」，序号两位补零，ZIP 条目同名也会被序号区分开。
 */
import type { Zippable } from 'fflate';
import { wait, yieldToPaint } from './async';
import { sanitizeFileName, saveBlob } from './download';
import { failureCount, summarizeFailures, tallyFailure } from './failures';
import type { ImageExportOptions } from './types';

export interface ImagePage {
  canvas: HTMLCanvasElement;
  widthMm: number;
  heightMm: number;
  /** 这一页的标题（文件名与拼接标题都用它） */
  label: string;
  /** 序号（1 开始），用于文件名唯一化 */
  index?: number;
  /** 二维码内容，写进清单 */
  content?: string;
}

export interface ImageExportOutcome {
  files: { name: string; bytes: number }[];
  pages: number;
  /** 没能写进成品的张数（渲染失败 / 编码失败 / 超出打包上限） */
  failed: number;
  /** 失败原因（去重，最多 3 条人话），拿给状态行直接用 */
  failureReasons: string[];
  /** 拼接产物信息（非拼接模式为 null） */
  stitched: { width: number; height: number; scale: number } | null;
}

/** 拼接结果的总像素上限：超过就整体等比缩小，避免一次占几百 MB 内存 */
const STITCH_MAX_PIXELS = 40_000_000;
/** 打包模式的累计字节上限：再往上攒，浏览器会因为一份超大 Blob 直接崩，到顶就停止打包 */
const ZIP_MAX_BYTES = 512 * 1024 * 1024;
/** 逐张模式两张下载之间的间隔 */
const EACH_DELAY_MS = 140;
/** 拼接时每张图下方的标题带高度（毫米） */
const CAPTION_MM = 5;

type Progress = (done: number, total: number, note: string) => void;

function toBlobAsync(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  const { promise, resolve, reject } = (
    Promise as PromiseConstructor & {
      withResolvers<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };
    }
  ).withResolvers<Blob>();
  canvas.toBlob(
    (blob) => {
      if (blob) resolve(blob);
      else reject(new Error('画布编码失败（toBlob 返回空）'));
    },
    type,
    quality,
  );
  return promise;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

/** 按选项编码一页；JPEG 走背景合成副本，PNG 直接编码 */
async function encodePage(page: ImagePage, options: ImageExportOptions): Promise<Blob> {
  if (options.format === 'png') return toBlobAsync(page.canvas, 'image/png');

  const source = page.canvas;
  const flat = createCanvas(source.width, source.height);
  const ctx = flat.getContext('2d');
  if (!ctx) throw new Error('拿不到 2D 上下文');
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(source, 0, 0);
  return toBlobAsync(flat, 'image/jpeg', options.quality);
}

function extensionOf(options: ImageExportOptions): string {
  return options.format === 'png' ? 'png' : 'jpg';
}

function fileNameFor(page: ImagePage, position: number, options: ImageExportOptions): string {
  const sequence = String(page.index ?? position + 1).padStart(2, '0');
  return `${sequence}-${sanitizeFileName(page.label || `标签${position + 1}`)}.${extensionOf(options)}`;
}

/** 清单只列真的写进包里的张：先成功、后进清单，失败或超限的页不会串名 */
function manifestCsv(rows: { page: ImagePage; name: string }[]): Uint8Array {
  const lines = ['序号,标题,内容,文件名'];
  rows.forEach(({ page, name }, position) => {
    const escape = (value: string) => `"${(value ?? '').replace(/"/g, '""')}"`;
    lines.push(
      [escape(String(page.index ?? position + 1)), escape(page.label), escape(page.content ?? ''), escape(name)].join(','),
    );
  });
  return new TextEncoder().encode(`\uFEFF${lines.join('\r\n')}\r\n`);
}

/** 拼接：网格 / 纵向 / 横向，可选每张下面的标题带 */
function stitchPages(pages: ImagePage[], options: ImageExportOptions): { canvas: HTMLCanvasElement; scale: number } {
  const { placement, columns, gapMm, captions } = options.stitch;
  const pxPerMm = pages[0].canvas.width / Math.max(1, pages[0].widthMm);
  const cellW = Math.max(...pages.map((page) => page.widthMm));
  const cellH = Math.max(...pages.map((page) => page.heightMm));
  const captionMm = captions ? CAPTION_MM : 0;

  const cols = placement === 'vertical' ? 1 : placement === 'horizontal' ? pages.length : Math.min(8, Math.max(1, Math.round(columns)));
  const rows = Math.ceil(pages.length / cols);

  const sheetWmm = cols * cellW + (cols + 1) * gapMm;
  const sheetHmm = rows * (cellH + captionMm) + (rows + 1) * gapMm;

  const rawW = sheetWmm * pxPerMm;
  const rawH = sheetHmm * pxPerMm;
  const scale = rawW * rawH > STITCH_MAX_PIXELS ? Math.sqrt(STITCH_MAX_PIXELS / (rawW * rawH)) : 1;

  const canvas = createCanvas(rawW * scale, rawH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('拿不到 2D 上下文');
  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const s = pxPerMm * scale;
  pages.forEach((page, position) => {
    const col = position % cols;
    const row = Math.floor(position / cols);
    const cellX = (gapMm + col * (cellW + gapMm)) * s;
    const cellY = (gapMm + row * (cellH + captionMm + gapMm)) * s;
    const drawW = page.widthMm * s;
    const drawH = page.heightMm * s;
    // 图在自己的格子里居中（尺寸不同也不拉伸）
    ctx.drawImage(page.canvas, cellX + (cellW * s - drawW) / 2, cellY + (cellH * s - drawH) / 2, drawW, drawH);
    if (captions) {
      const fontPx = Math.max(8, Math.round(cellH * s * 0.04));
      ctx.fillStyle = '#101010';
      ctx.font = `400 ${fontPx}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = page.label;
      ctx.fillText(text, cellX + (cellW * s) / 2, cellY + cellH * s + (captionMm * s) / 2, cellW * s);
      ctx.textAlign = 'start';
    }
  });

  return { canvas, scale };
}

export async function exportImages(
  pages: ImagePage[],
  options: ImageExportOptions,
  onProgress?: Progress,
): Promise<ImageExportOutcome> {
  const total = pages.length;
  if (total === 0) return { files: [], pages: 0, failed: 0, failureReasons: [], stitched: null };

  const files: { name: string; bytes: number }[] = [];
  const mode = options.mode;

  if (mode === 'each') {
    const failures = new Map<string, number>();
    for (let position = 0; position < total; position += 1) {
      const page = pages[position];
      const name = fileNameFor(page, position, options);
      try {
        const blob = await encodePage(page, options);
        saveBlob(blob, name);
        files.push({ name, bytes: blob.size });
      } catch (cause) {
        tallyFailure(failures, cause instanceof Error ? cause.message : '画布编码失败');
      }
      onProgress?.(position + 1, total, `逐张 ${position + 1}/${total}`);
      await yieldToPaint();
      if (position < total - 1) await wait(EACH_DELAY_MS);
    }
    return { files, pages: total, failed: failureCount(failures), failureReasons: summarizeFailures(failures, '张'), stitched: null };
  }

  if (mode === 'zip') {
    const failures = new Map<string, number>();
    const entries: Zippable = {};
    const packed: { page: ImagePage; name: string }[] = [];
    let bytes = 0;
    for (let position = 0; position < total; position += 1) {
      const page = pages[position];
      const name = fileNameFor(page, position, options);
      try {
        const blob = await encodePage(page, options);
        if (bytes + blob.size > ZIP_MAX_BYTES) {
          // 到顶就停下：再攒下去浏览器会因为一份超大 Blob 直接崩
          tallyFailure(failures, `打包体积超出 ${Math.round(ZIP_MAX_BYTES / 1024 / 1024)} MB 上限`, total - position);
          break;
        }
        entries[name] = new Uint8Array(await blob.arrayBuffer());
        bytes += blob.size;
        packed.push({ page, name }); // 真的写进包里了才进清单，失败不会串名
      } catch (cause) {
        tallyFailure(failures, cause instanceof Error ? cause.message : '画布编码失败');
      }
      onProgress?.(position + 1, total, `打包 ${position + 1}/${total}`);
      await yieldToPaint();
    }
    if (packed.length === 0) {
      return { files, pages: total, failed: failureCount(failures), failureReasons: summarizeFailures(failures, '张'), stitched: null };
    }
    entries['清单.csv'] = manifestCsv(packed);
    try {
      // 图片本身已是压缩格式，ZIP 用存储模式（不重复压一遍），快且不卡；fflate 到这一步才加载
      const { zipSync } = await import('fflate');
      const zipped = zipSync(entries, { level: 0 });
      const zipName = `${sanitizeFileName(packed[0].page.label || 'qrstick')}-${packed.length}张.zip`;
      saveBlob(new Blob([zipped], { type: 'application/zip' }), zipName);
      files.push({ name: zipName, bytes: zipped.byteLength });
    } catch {
      tallyFailure(failures, '打包压缩失败（内存不足）');
    }
    return { files, pages: total, failed: failureCount(failures), failureReasons: summarizeFailures(failures, '张'), stitched: null };
  }

  onProgress?.(0, total, `拼接 ${total} 张`);
  await yieldToPaint();
  const { canvas, scale } = stitchPages(pages, options);
  const name = `拼接-${total}张.${extensionOf(options)}`;
  const blob = await toBlobAsync(canvas, options.format === 'png' ? 'image/png' : 'image/jpeg', options.quality);
  saveBlob(blob, name);
  files.push({ name, bytes: blob.size });
  onProgress?.(total, total, `拼接 ${total} 张`);
  return { files, pages: total, failed: 0, failureReasons: [], stitched: { width: canvas.width, height: canvas.height, scale } };
}