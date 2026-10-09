/**
 * 预览缩放：印张预览与多图预览共用同一条规则。
 *
 * 导出永远用满 DPI（scale = 1）；界面上的画布按最长边降采样，
 * 两个地方各算一次容易出现「单张预览清楚、多图预览糊」这类不一致。
 */
import type { LabelLayout } from './render';

/** 预览画布的最长边（像素） */
export const PREVIEW_MAX_PX = 1800;

/** 缩略图的最长边：多图预览一屏要摆很多张，比单张预览小一档 */
export const THUMB_MAX_PX = 760;

export function previewScaleFor(layout: LabelLayout, maxPx: number = PREVIEW_MAX_PX): number {
  return Math.min(1, maxPx / Math.max(1, Math.max(layout.pixelWidth, layout.pixelHeight)));
}