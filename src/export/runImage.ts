/**
 * 出片（图片）编排：把当前参数或整批数据渲染成画布，交给 exportImage 按模式写出。
 *
 * 与 PNG/PDF/Word 的编排分开：那三种是「一份文档」，图片导出有逐张 / 打包 / 拼接三种模式，
 * 但两者共用同一个渲染核（renderLabel）与同一份 store 数据——导出的永远是当前编辑后的内容，
 * 界面里没有任何一份「预览缓存」参与导出。
 *
 * 逐页隔离：一页渲染不出来（内容超容量 / 画布分配失败）只记进失败清单，其余照常出。
 */
import { buildBatch } from '../lib/batch';
import { sanitizeFileName } from '../lib/download';
import { exportImages, type ImageExportOutcome, type ImagePage } from '../lib/exportImage';
import { failureCount, renderFailureText, summarizeFailures, tallyFailure } from '../lib/failures';
import { renderLabel } from '../lib/render';
import { sheetSize } from '../lib/units';
import type { BatchRow, ImageExportOptions, LabelConfig } from '../lib/types';

export interface ImageExportRequest {
  config: LabelConfig;
  /** 批量模式下要出的行；单张模式传空数组 */
  rows: BatchRow[];
  /** 多选行（非空则只出这些行，顺序与表格一致） */
  picked: BatchRow[];
  options: ImageExportOptions;
  onProgress?: (done: number, total: number, note: string) => void;
}

export interface ImageExportResult extends ImageExportOutcome {
  /** 界面上的说法，例如「出片 PNG（打包） 12 张」 */
  action: string;
  /** 回显给状态行的文件名（逐张模式只报第一个） */
  fileName: string;
}

const MODE_LABEL: Record<ImageExportOptions['mode'], string> = {
  each: '逐张',
  zip: '打包',
  stitch: '拼接',
};

export async function runImageExport(request: ImageExportRequest): Promise<ImageExportResult> {
  const { config, rows, picked, options, onProgress } = request;
  const targets: LabelConfig[] =
    rows.length === 0
      ? [config]
      : buildBatch(config, picked.length ? picked : rows);

  // 逐页渲染：一页坏只记进失败清单，其余照常进成品，绝不让整批一起丢
  const pages: ImagePage[] = [];
  const renderFailures = new Map<string, number>();
  for (let position = 0; position < targets.length; position += 1) {
    const target = targets[position];
    try {
      const { canvas, failure } = renderLabel(target);
      if (failure) {
        tallyFailure(renderFailures, renderFailureText(failure));
        continue;
      }
      const { widthMm, heightMm } = sheetSize(target.page);
      pages.push({
        canvas,
        widthMm,
        heightMm,
        label: target.title.text.trim() || `标签 ${position + 1}`,
        index: position + 1,
        content: target.content,
      });
    } catch {
      tallyFailure(renderFailures, renderFailureText('canvas_unavailable'));
    }
  }

  if (pages.length === 0) {
    throw new Error(`这一批 ${targets.length} 张都没能出图：${summarizeFailures(renderFailures, '张').join('；')}`);
  }

  const base = sanitizeFileName((targets[0] ?? config).title.text.trim() || 'qrstick');
  const outcome = await exportImages(pages, options, onProgress);
  // 渲染阶段的失败与编码阶段的失败合起来报，去重后最多三条
  const failureReasons = [...new Set([...summarizeFailures(renderFailures, '张'), ...outcome.failureReasons])].slice(0, 3);
  return {
    ...outcome,
    failed: failureCount(renderFailures) + outcome.failed,
    failureReasons,
    action: `出片 ${options.format.toUpperCase()}（${MODE_LABEL[options.mode]}）`,
    fileName: outcome.files[0]?.name ?? base,
  };
}