/**
 * 导出失败的统一说法：渲染核的 failure 与导出阶段被跳过的页/张都汇总成「人话原因 + 次数」。
 *
 * 文档导出（`export/run.ts`）与图片导出（`lib/exportImage.ts`）共用这一份，
 * 状态行只认这份形状——所以它不能挂在任何一侧的导出模块里，否则文档侧会反向依赖图片侧。
 */
import type { RenderFailure } from './types';

/** 失败原因最多报几条（再多状态行也放不下） */
export const MAX_FAILURE_REASONS = 3;

/** 渲染失败的人话说法：占位框二维码与分配失败的画布都不能进成品 */
export function renderFailureText(failure: RenderFailure): string {
  return failure === 'qr_overflow' ? '内容超出二维码容量' : '画布尺寸超出浏览器上限';
}

/** 记一笔失败原因；同一原因累加次数 */
export function tallyFailure(counts: Map<string, number>, reason: string, times = 1): void {
  counts.set(reason, (counts.get(reason) ?? 0) + times);
}

/** 失败总数：各原因次数之和 */
export function failureCount(counts: Map<string, number>): number {
  let sum = 0;
  for (const times of counts.values()) sum += times;
  return sum;
}

/** 失败原因归并成最多三条人话，按影响面从大到小；unit 是界面上的量词（页 / 张） */
export function summarizeFailures(counts: Map<string, number>, unit = '页'): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_FAILURE_REASONS)
    .map(([reason, times]) => `${reason}，已跳过 ${times} ${unit}`);
}