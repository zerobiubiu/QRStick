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
import { yieldToPaint } from '../lib/async';
import { createPdfBuilder, exportPng, exportWord, type ExportPage, type WordPage } from '../lib/export';
import { failureCount, renderFailureText, summarizeFailures, tallyFailure } from '../lib/failures';
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
  /** 跳过的页数：这一批里没能出图、没有写进成品的页 */
  failed: number;
  /** 失败原因（去重，最多 3 条人话），拿给状态行直接用 */
  failureReasons: string[];
}

/** 进度回调：批量出码时界面靠它报「第 n / 共 m 页」 */
export type ExportProgress = (done: number, total: number) => void;

/** 渲染一页；出不了图（占位框二维码 / 分配失败的画布）返回 null，这一页不进成品 */
function toExportPage(config: LabelConfig): ExportPage | null {
  const { canvas, failure } = renderLabel(config);
  if (failure) return null;
  const { widthMm, heightMm } = sheetSize(config.page);
  return { canvas, widthMm, heightMm };
}

/** 这一页没能出图的人话原因（只在失败分支里调用，代价是一次版式计算） */
function failureReasonFor(config: LabelConfig): string {
  return renderFailureText(layoutLabel(config).qrOverflow ? 'qr_overflow' : 'canvas_unavailable');
}

async function toWordPage(config: LabelConfig): Promise<WordPage | null> {
  const layout = layoutLabel(config);
  const qr = renderQrCode(
    config.content,
    config.qr.sizeMm,
    config.page.dpi,
    config.qr.errorCorrectionLevel,
    config.qr.quietZoneModules,
  );
  // 占位框二维码、或画布被浏览器夹小：都不进成品
  if (qr.overflow || qr.canvas.width !== qr.sidePx || qr.canvas.height !== qr.sidePx) return null;
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
  const batchConfigs = rows.length ? buildBatch(config, rows) : [];
  // 文件名基准取「真正要出的那一张」的标题：批量时用第一行的标题，不用单张态的参数
  const base = sanitizeFileName((batchConfigs[0] ?? config).title.text.trim() || 'qrstick');

  if (format === 'png') {
    const position = rows.length ? Math.max(0, rows.findIndex((row) => row.index === selectedRow)) : -1;
    const target = rows.length ? batchConfigs[position] ?? batchConfigs[0] : config;
    const suffix = rows.length ? `-第${position + 1}张` : '';
    const name = `${base}${suffix}`;
    onProgress?.(0, 1);
    const page = toExportPage(target);
    if (!page) throw new Error(`没能出图：${failureReasonFor(target)}`);
    await exportPng(page, name);
    onProgress?.(1, 1);
    return { action, fileName: `${name}.png`, pages: 1, failed: 0, failureReasons: [] };
  }

  const targets = batchConfigs.length ? batchConfigs : [config];
  const name = batchConfigs.length > 1 ? `${base}-${batchConfigs.length}张` : base;
  onProgress?.(0, targets.length);

  if (format === 'pdf') {
    const builder = await createPdfBuilder();
    const failures = new Map<string, number>();
    let written = 0;
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      try {
        const page = toExportPage(target);
        if (!page) tallyFailure(failures, failureReasonFor(target));
        else if (builder.addPage(page)) written += 1;
        else tallyFailure(failures, '画布编码失败，这一页没有写进文档');
      } catch {
        tallyFailure(failures, renderFailureText('canvas_unavailable'));
      }
      onProgress?.(index + 1, targets.length);
      await yieldToPaint();
    }
    if (written === 0) throw new Error(`这一批 ${targets.length} 页都没能出图，没有生成文件`);
    builder.save(name);
    return {
      action,
      fileName: `${name}.pdf`,
      pages: written,
      failed: failureCount(failures),
      failureReasons: summarizeFailures(failures),
    };
  }

  const wordPages: WordPage[] = [];
  const failures = new Map<string, number>();
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    try {
      const page = await toWordPage(target);
      if (page) wordPages.push(page);
      else tallyFailure(failures, failureReasonFor(target));
    } catch {
      tallyFailure(failures, renderFailureText('canvas_unavailable'));
    }
    onProgress?.(index + 1, targets.length);
    await yieldToPaint();
  }
  if (wordPages.length === 0) throw new Error(`这一批 ${targets.length} 页都没能出图，没有生成文件`);
  await exportWord(wordPages, name);
  return {
    action,
    fileName: `${name}.docx`,
    pages: wordPages.length,
    failed: failureCount(failures),
    failureReasons: summarizeFailures(failures),
  };
}
