/**
 * 标签渲染的全部参数字面量与类型定义。
 *
 * 约定：本文件不依赖任何 UI 或库，渲染核（render.ts）、导出（export/*）、
 * 批量（batch.ts）与界面层都只通过这里的数据形状通信。
 */

/** 标题水平对齐 */
export type Align = 'left' | 'center' | 'right';

/** 标题相对二维码的位置 */
export type TitlePosition = 'above' | 'below';

/** 二维码纠错等级 */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

/** 纸张预设：portrait（纵向）下的宽高，单位毫米 */
export interface PagePreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

/** 页面（印张）参数 */
export interface PageConfig {
  /** 预设 id，见 units.ts 的 PAGE_PRESETS；'custom' 表示自定义宽高 */
  presetId: string;
  /** 纵向下的宽度 / 高度，毫米 */
  widthMm: number;
  heightMm: number;
  /** true 时宽高对调（横向） */
  landscape: boolean;
  /** 分辨率，像素/英寸。决定导出像素密度 */
  dpi: number;
  /** 四边页边距，毫米。标签内容不会越出这个边界 */
  marginMm: number;
}

/** 二维码参数 */
export interface QrConfig {
  /** 二维码边长，毫米（不含静默区） */
  sizeMm: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  /** 静默区模块数，默认 4 */
  quietZoneModules: number;
}

/** 标题格式 */
export interface TitleConfig {
  text: string;
  /** 字体 id，见 fonts.ts 的 LABEL_FONTS */
  fontId: string;
  /** 字号，磅（pt） */
  fontSizePt: number;
  bold: boolean;
  align: Align;
  position: TitlePosition;
  /** 标题与二维码之间的间距，毫米 */
  gapMm: number;
  /** 行高倍数，默认 1.25 */
  lineHeight: number;
}

/** 导出件上的印刷标记（默认全关，导出就是一张干净的标签） */
export interface MarksConfig {
  /** 四角裁切标记 */
  cropMarks: boolean;
  /** 色标条与规格读数（模块尺寸 / 纠错等级 / DPI） */
  colorBar: boolean;
  /** 页边距参考虚线 */
  marginGuides: boolean;
}

/** 一次生成的完整输入 */
export interface LabelConfig {
  page: PageConfig;
  qr: QrConfig;
  title: TitleConfig;
  /** 二维码承载的内容；批量模式下每行覆盖 */
  content: string;
  marks: MarksConfig;
}

/** 批量数据源：一行一条 */
export interface BatchRow {
  /** 行号，从 1 开始（表头不计） */
  index: number;
  title: string;
  content: string;
}

/** 渲染结果，供预览与导出共用 */
export interface RenderResult {
  canvas: HTMLCanvasElement;
  /** 画布像素宽高 */
  pixelWidth: number;
  pixelHeight: number;
  /** 二维码模块边长（像素，整数），导出即按它落地，保证不糊 */
  modulePx: number;
  /** 二维码版本号（模块矩阵边长），用于读数 */
  qrModules: number;
  /** 是否因内容过长而回退到更低纠错等级 */
  downgraded: boolean;
}
