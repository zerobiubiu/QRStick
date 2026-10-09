/**
 * 出片 / 付印 / 交版：把参数（或整批数据）送到导出模块。
 *
 * 这里是唯一把「参数 → 画布 → 文件」串起来的地方：
 *  - 出片 PNG：当前印张按 DPI 原样出图（批量时出当前选中那一张）；
 *  - 付印 PDF：一页一张标签，页面尺寸就是印张毫米尺寸，逐页写出不攒画布；
 *  - 交版 Word：标题是可编辑文字、二维码是图，交给别人还能改字。
 *
 * 批量出码必须边渲染边写出：A4 300 DPI 一页画布就是 35 MB，攒够两百页浏览器会崩。
 */
import { buildBatch } from '../lib/batch';
import { canvasToPngBlob, sanitizeFileName } from '../lib/download';
import { createPdfBuilder, exportPng, exportWord, type ExportPage, type WordPage } from '../lib/export';
import { layoutLabel, renderLabel, renderQrCode } from '../lib/render';
import { pxToMm, sheetSize } from '../lib/units';
import type { BatchRow, LabelConfig } from '../lib/types';

export type ExportFormat = 'png' | 'pdf' | 'word';

/** 界面上的说法：出片 / 付印 / 交版 */
export const EXPORT_ACTION: Record<ExportFormat, string> = {
  png: '出片 PNG',
  pdf: '付印 PDF',
  word: '交版 Word',
};

export interface ExportRequest {
  format: ExportFormat;
  config: LabelConfig;
  /** 批量模式下的数据行；单张模式传空数组 */
  rows: BatchRow[];
  /** 批量出 PNG 时选中的那一行 */
  selectedRow: number;
}

export interface ExportOutcome {
  action: string;
  fileName: string;
  pages: number;
}

/** 进度回调：批量出码时界面靠它报「第 n / 共 m 页」 */
export type ExportProgress = (done: number, total: number) => void;

/**
 * 让出一次事件循环：批量出码时界面要能继续把进度画出来。
 *
 * 项目 lib 停在 ES2023，`Promise.withResolvers` 的类型还没进 lib，
 * 这里就地补一次形状（现代 Chromium 运行时本来就有这个方法）。
 */
function yieldToPaint(): Promise<void> {
  const { promise, resolve } = (
    Promise as PromiseConstructor & {
      withResolvers<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void };
    }
  ).withResolvers<void>();
  setTimeout(resolve, 0);
  return promise;
}

function toExportPage(config: LabelConfig): ExportPage {
  const { canvas } = renderLabel(config);
  const { widthMm, heightMm } = sheetSize(config.page);
  return { canvas, widthMm, heightMm };
}

async function toWordPage(config: LabelConfig): Promise<WordPage> {
  const layout = layoutLabel(config);
  const qr = renderQrCode(
    config.content,
    config.qr.sizeMm,
    config.page.dpi,
    config.qr.errorCorrectionLevel,
    config.qr.quietZoneModules,
  );
  const blob = await canvasToPngBlob(qr.canvas);
  const { widthMm, heightMm } = sheetSize(config.page);
  return {
    title: config.title.text,
    qrPng: new Uint8Array(await blob.arrayBuffer()),
    qrSizeMm: pxToMm(layout.qrSidePx, layout.dpi),
    widthMm,
    heightMm,
    marginMm: config.page.marginMm,
    fontId: config.title.fontId,
    fontSizePt: config.title.fontSizePt,
    bold: config.title.bold,
    align: config.title.align,
    position: config.title.position,
    gapMm: config.title.gapMm,
  };
}

export async function runExport(request: ExportRequest, onProgress?: ExportProgress): Promise<ExportOutcome> {
  const { format, config, rows, selectedRow } = request;
  const action = EXPORT_ACTION[format];
  const base = sanitizeFileName(config.title.text.trim() || 'qrstick');
  const batchConfigs = rows.length ? buildBatch(config, rows) : [];

  if (format === 'png') {
    const position = rows.length ? Math.max(0, rows.findIndex((row) => row.index === selectedRow)) : -1;
    const target = rows.length ? batchConfigs[position] ?? batchConfigs[0] : config;
    const suffix = rows.length ? `-第${position + 1}张` : '';
    const name = `${base}${suffix}`;
    onProgress?.(0, 1);
    await exportPng(toExportPage(target), name);
    onProgress?.(1, 1);
    return { action, fileName: `${name}.png`, pages: 1 };
  }

  const targets = batchConfigs.length ? batchConfigs : [config];
  const name = batchConfigs.length > 1 ? `${base}-${batchConfigs.length}张` : base;
  onProgress?.(0, targets.length);

  if (format === 'pdf') {
    const builder = createPdfBuilder();
    for (let index = 0; index < targets.length; index += 1) {
      builder.addPage(toExportPage(targets[index]));
      onProgress?.(index + 1, targets.length);
      await yieldToPaint();
    }
    builder.save(name);
    return { action, fileName: `${name}.pdf`, pages: targets.length };
  }

  const wordPages: WordPage[] = [];
  for (let index = 0; index < targets.length; index += 1) {
    wordPages.push(await toWordPage(targets[index]));
    onProgress?.(index + 1, targets.length);
    await yieldToPaint();
  }
  await exportWord(wordPages, name);
  return { action, fileName: `${name}.docx`, pages: wordPages.length };
}
