/**
 * 单位换算与纸张预设。
 *
 * 全项目的尺寸都走毫米 → 像素的显式换算：mm 是版面真相，px 是导出真相，
 * 中间不经过任何 CSS 或浏览器的隐式换算。
 */
import type { PageConfig, PagePreset } from './types';

export const MM_PER_INCH = 25.4;

/** 纸张预设（纵向尺寸，单位毫米） */
export const PAGE_PRESETS: PagePreset[] = [
  { id: 'A4', label: 'A4 210 × 297 mm', widthMm: 210, heightMm: 297 },
  { id: 'A5', label: 'A5 148 × 210 mm', widthMm: 148, heightMm: 210 },
  { id: 'A6', label: 'A6 105 × 148 mm', widthMm: 105, heightMm: 148 },
  { id: 'A3', label: 'A3 297 × 420 mm', widthMm: 297, heightMm: 420 },
  { id: 'B5', label: 'B5 176 × 250 mm', widthMm: 176, heightMm: 250 },
  { id: 'Letter', label: 'Letter 215.9 × 279.4 mm', widthMm: 215.9, heightMm: 279.4 },
  // 现场最常用的贴纸 / 热敏标签纸：预设写的是它本来的样子（选完即按这个方向落纸）
  { id: 'label-60x40', label: '贴纸 60 × 40 mm', widthMm: 60, heightMm: 40 },
  { id: 'label-80x50', label: '贴纸 80 × 50 mm', widthMm: 80, heightMm: 50 },
  { id: 'label-100x150', label: '标签 100 × 150 mm', widthMm: 100, heightMm: 150 },
  { id: 'label-4x6', label: '标签 4 × 6 in（101.6 × 152.4 mm）', widthMm: 101.6, heightMm: 152.4 },
  { id: 'custom', label: '自定义', widthMm: 210, heightMm: 297 },
];

export const DPI_PRESETS = [72, 96, 150, 300, 600];

/** 毫米 → 像素（不取整，用于文字等需要亚像素精度的场合） */
export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

/** 毫米 → 整数像素（用于模块、边线等必须对齐设备像素的场合） */
export function mmToPxInt(mm: number, dpi: number): number {
  return Math.max(1, Math.round(mmToPx(mm, dpi)));
}

/** 像素 → 毫米，用于把落地后的整数像素尺寸回读成毫米读数 */
export function pxToMm(px: number, dpi: number): number {
  return (px * MM_PER_INCH) / dpi;
}

/** 磅 → 像素：字号在不同 DPI 下的真实高度 */
export function ptToPx(pt: number, dpi: number): number {
  return (pt / 72) * dpi;
}

export function findPreset(presetId: string): PagePreset {
  return PAGE_PRESETS.find((p) => p.id === presetId) ?? PAGE_PRESETS[0];
}

/** 应用横向/纵向，返回实际印张尺寸（毫米） */
export function sheetSize(page: PageConfig): { widthMm: number; heightMm: number } {
  return page.landscape
    ? { widthMm: page.heightMm, heightMm: page.widthMm }
    : { widthMm: page.widthMm, heightMm: page.heightMm };
}

/** 数值裁剪到区间并保留指定小数位；非法值回落到 min */
export function clamp(value: number, min: number, max: number, decimals = 1): number {
  if (!Number.isFinite(value)) return min;
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Math.min(max, Math.max(min, rounded));
}

/**
 * 解析长宽比文本，支持 "1:1.414"、"3:4"、"1/1.414"、"0.707" 四种写法。
 * 返回 高 / 宽 的比值；解析失败返回 null。
 */
export function parseAspectRatio(input: string): number | null {
  const text = input.trim().replace(/：/g, ':');
  if (!text) return null;
  if (text.includes(':') || text.includes('/')) {
    const [a, b] = text.split(/[:/]/);
    const w = Number(a);
    const h = Number(b);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return h / w;
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** 毫米数值的显示格式：整数不带小数点，其余保留一位 */
export function formatMm(mm: number): string {
  return Number.isInteger(mm) ? String(mm) : mm.toFixed(1);
}
