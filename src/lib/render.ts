/**
 * 渲染核：把 LabelConfig 画成一张画布。
 *
 * 预览与导出共用这一条路径（差别只有缩放系数），所以「屏幕上看到的就是打印出来的」。
 * 关键纪律：
 *  - 毫米是版面真相，像素是导出真相；所有落地尺寸都按 DPI 换算后再回读成毫米读数；
 *  - 二维码按整数像素 / 模块绘制，绝不缩放，模块边界永远落在设备像素上；
 *  - 没内容或内容超出二维码容量都画占位框，**绝不抛异常**；内容过长自动降纠错等级并如实上报；
 *  - 画布分配失败（尺寸超过浏览器上限）要显式报失败，绝不能返回一张空白还当成成功。
 */
import QRCode from 'qrcode';
import { resolveLabelFont } from './fonts';
import { mmToPx, pxToMm, ptToPx, sheetSize } from './units';
import type { ErrorCorrectionLevel, LabelConfig, RenderFailure, RenderResult } from './types';

/** 纠错等级由强到弱，内容塞不下时按这个顺序回退 */
const ECL_ORDER: ErrorCorrectionLevel[] = ['H', 'Q', 'M', 'L'];

/** 版本 40、字节模式下各纠错等级能装的最大字节数（UTF-8 计）：用来提前判容量，不必靠抛异常试探 */
const ECL_BYTE_CAPACITY: Record<ErrorCorrectionLevel, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

/** 超过这个兆像素：导出慢且吃内存，提醒但不拦 */
const CANVAS_WARN_MEGAPIXELS = 60;
/** 超过这个兆像素：浏览器多半分配不出画布，按错误拦下（A4@600 约 35 兆像素） */
const MAX_RENDER_MEGAPIXELS = 100;
/** 标题最多占版心高度的比例：超出的行不印，二维码至少留四成高度，免得被挤成废码 */
const TITLE_MAX_HEIGHT_SHARE = 0.6;

const INK = '#101010';
const PAPER = '#ffffff';
/** 印刷四原色（色标条用，与套准十字同源） */
const PROCESS_INKS = ['#00a0e9', '#e6007e', '#fff200', '#231815'];

export interface QrRender {
  canvas: HTMLCanvasElement;
  /** 单模块边长（整数像素） */
  modulePx: number;
  /** 含静默区的矩阵边长，单位模块 */
  modules: number;
  /** 落地边长（像素） */
  sidePx: number;
  /** 是否因内容过长回退到更低纠错等级 */
  downgraded: boolean;
  /** 内容为空时的占位状态 */
  empty: boolean;
  /** 内容超出二维码容量（四级全装不下）：画的是占位框，张贴物上不会有可扫的码 */
  overflow: boolean;
  /** 实际使用的纠错等级（回退之后），读数与色标条以它为准 */
  level: ErrorCorrectionLevel;
}

/** 版式几何（全部为像素，毫米读数由调用方按 DPI 回读） */
export interface LabelLayout {
  sheetWidthMm: number;
  sheetHeightMm: number;
  dpi: number;
  pixelWidth: number;
  pixelHeight: number;
  marginPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  titleLines: string[];
  titleFontPx: number;
  titleFontCss: string;
  titleLineHeightPx: number;
  titleHeightPx: number;
  titleYPx: number;
  gapPx: number;
  qrRequestedPx: number;
  /** 预览画布上二维码的实际绘制边长（像素；可能已被等比缩放） */
  qrSidePx: number;
  /** 二维码在**导出网格**上的落地边长（像素）；模块边长与它配套，打印与读数都以它为准 */
  qrExportSidePx: number;
  /** 单模块边长（整数像素，导出网格） */
  qrModulePx: number;
  /** 二维码落地后的**外框**边长（毫米，含静默区）——屏幕上拿尺子量到的是码面，不是这个数 */
  qrActualMm: number;
  /** 码面边长（毫米，不含静默区）——「贴纸要多大的黑方块」就是它 */
  qrInkMm: number;
  qrModules: number;
  qrX: number;
  qrY: number;
  /** 被版心或剩余高度**真的**限住（与「整数像素取整导致的微小缩短」是两回事） */
  spaceLimited: boolean;
  /** 字号过大导致标题自己就溢出版心 */
  titleOverflow: boolean;
  /** 标题因超出「最多占版心六成」而被裁掉的行数 */
  titleClippedLines: number;
  /** 二维码内容超出容量（四级全装不下）：版面上只有占位框 */
  qrOverflow: boolean;
  /** 实际使用的纠错等级（内容过长会回退），读数与色标条以它为准 */
  actualErrorCorrectionLevel: ErrorCorrectionLevel;
}

export interface LabelIssue {
  level: 'warn' | 'error';
  message: string;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function measureWidth(text: string, fontCss: string): number {
  // 无 DOM 环境（单测 / SSR）拿不到测量上下文：退回按字数估算，绝不让测量本身抛异常
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  const ctx = measureCtx;
  if (!ctx) return text.length * 8;
  if (ctx.font !== fontCss) ctx.font = fontCss;
  return ctx.measureText(text).width;
}

/** 切成字素簇：ZWJ 组合 emoji、变体选择符、组合附加符都算一个单位，断行不会把它们切散 */
function graphemes(text: string): string[] {
  const Segmenter = typeof Intl !== 'undefined' ? (Intl as { Segmenter?: new (locale?: string, options?: { granularity: string }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter : undefined;
  if (Segmenter) {
    return [...new Segmenter('zh', { granularity: 'grapheme' }).segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

/** 按可用宽度折行：中文逐字断，西文优先在空格处断；宽度按字素簇累加，万字号标题也不会退化成 O(n²) 测量 */
function wrapTitleLines(raw: string, maxWidthPx: number, fontCss: string): string[] {
  const out: string[] = [];
  for (const paragraph of raw.replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph.trim()) {
      out.push('');
      continue;
    }
    let line: { unit: string; width: number }[] = [];
    let lineWidth = 0;
    for (const unit of graphemes(paragraph)) {
      const unitWidth = measureWidth(unit, fontCss);
      if (line.length && maxWidthPx > 0 && lineWidth + unitWidth > maxWidthPx) {
        const text = line.map((item) => item.unit).join('');
        const spaceAt = text.lastIndexOf(' ');
        if (spaceAt > 0 && spaceAt >= text.length * 0.3) {
          out.push(text.slice(0, spaceAt));
          const rest = graphemes(text.slice(spaceAt + 1));
          line = rest.map((u) => ({ unit: u, width: measureWidth(u, fontCss) }));
          lineWidth = line.reduce((sum, item) => sum + item.width, 0);
        } else {
          out.push(text);
          line = [];
          lineWidth = 0;
        }
      }
      line.push({ unit, width: unitWidth });
      lineWidth += unitWidth;
    }
    out.push(line.map((item) => item.unit).join(''));
  }
  return out.map((l) => l.replace(/\s+$/, ''));
}

/** 生成二维码矩阵：按 H→Q→M→L 逐级回退；四级都装不下时返回 null（容量超限，交给调用方画占位框） */
function createQrMatrix(content: string, requested: ErrorCorrectionLevel) {
  // 非法等级（手改的预设 JSON）回落到 M，仍然走完整回退顺序，不要只留最后一级
  const index = ECL_ORDER.indexOf(requested);
  const levels = ECL_ORDER.slice(index < 0 ? ECL_ORDER.indexOf('M') : index);
  for (const level of levels) {
    try {
      const qr = QRCode.create(content, { errorCorrectionLevel: level });
      return { matrix: qr.modules, level, downgraded: level !== requested };
    } catch {
      // 这一级装不下，继续试更低一级；四级全失败时返回 null，由调用方画占位框（不抛）
    }
  }
  return null;
}

/** 二维码位图缓存：同一份内容 + 同一落地尺寸会被反复索要（拖参数时 layoutLabel 与 renderLabel 各要一次），
 *  每次都重画是 20 兆像素级的画布分配与填充——参数改动不该为它等待 */
let qrMemo: { key: string; value: QrRender } | null = null;

/** 生成二维码画布：模块整数像素、静默区算在内，内容为空或超容量时给占位框；相同输入直接复用上一张 */
export function renderQrCode(
  content: string,
  sizeMm: number,
  dpi: number,
  level: ErrorCorrectionLevel,
  quietZoneModules = 4,
): QrRender {
  const key = `${content}\u0000${sizeMm}\u0000${dpi}\u0000${level}\u0000${quietZoneModules}`;
  if (qrMemo?.key === key) return qrMemo.value;
  const value = buildQrRender(content, sizeMm, dpi, level, quietZoneModules);
  qrMemo = { key, value };
  return value;
}

function buildQrRender(
  content: string,
  sizeMm: number,
  dpi: number,
  level: ErrorCorrectionLevel,
  quietZoneModules = 4,
): QrRender {
  const requestedPx = Math.max(1, Math.round(mmToPx(sizeMm, dpi)));
  const canvas = document.createElement('canvas');
  // 画不出码时（没内容 / 容量超限）画一张虚线占位框：印张上不留空白，也不抛异常打断整页
  const drawPlaceholder = () => {
    canvas.width = requestedPx;
    canvas.height = requestedPx;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = 'rgba(16,16,16,0.28)';
      ctx.lineWidth = Math.max(1, Math.round(dpi / 300));
      ctx.setLineDash([requestedPx / 16, requestedPx / 24]);
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, requestedPx - ctx.lineWidth, requestedPx - ctx.lineWidth);
      ctx.setLineDash([]);
    }
  };
  const placeholderQr = (overflow: boolean): QrRender => {
    drawPlaceholder();
    return { canvas, modulePx: 0, modules: 0, sidePx: requestedPx, downgraded: false, empty: !overflow, overflow, level };
  };

  if (!content.trim()) return placeholderQr(false);

  const built = createQrMatrix(content, level);
  if (!built) return placeholderQr(true);
  const { matrix, downgraded, level: actualLevel } = built;
  const quiet = Math.max(0, Math.round(quietZoneModules));
  const modules = matrix.size + quiet * 2;
  // 取整只允许「不超过」上限：向上取整会让印出来的码比版心还宽，
  // 也会让「空间不足」时二维码被挤成左贴而不是居中
  const rounded = Math.max(1, Math.round(requestedPx / modules));
  const modulePx = rounded * modules > requestedPx ? Math.max(1, Math.floor(requestedPx / modules)) : rounded;
  const sidePx = modulePx * modules;
  canvas.width = sidePx;
  canvas.height = sidePx;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, sidePx, sidePx);
    ctx.fillStyle = INK;
    for (let row = 0; row < matrix.size; row += 1) {
      for (let col = 0; col < matrix.size; col += 1) {
        if (matrix.data[row * matrix.size + col]) {
          ctx.fillRect((col + quiet) * modulePx, (row + quiet) * modulePx, modulePx, modulePx);
        }
      }
    }
  }

  return { canvas, modulePx, modules, sidePx, downgraded, empty: false, overflow: false, level: actualLevel };
}

interface Built {
  layout: LabelLayout;
  qr: QrRender;
  config: LabelConfig;
}

/** 版式计算：标尺、字号、折行、二维码落地尺寸，全部按 dpi 求出来 */
function build(config: LabelConfig, scale: number): Built {
  const dpi = config.page.dpi * scale;
  const { widthMm, heightMm } = sheetSize(config.page);
  const pixelWidth = Math.max(1, Math.round(mmToPx(widthMm, dpi)));
  const pixelHeight = Math.max(1, Math.round(mmToPx(heightMm, dpi)));
  const marginPx = Math.max(0, Math.round(mmToPx(Math.min(config.page.marginMm, Math.min(widthMm, heightMm) / 2 - 1), dpi)));
  const contentWidthPx = Math.max(0, pixelWidth - marginPx * 2);
  const contentHeightPx = Math.max(0, pixelHeight - marginPx * 2);

  const font = resolveLabelFont(config.title.fontId);
  const titleFontPx = Math.max(1, ptToPx(config.title.fontSizePt, dpi));
  const titleFontCss = `${config.title.bold ? '700' : '400'} ${titleFontPx}px ${font.stack}`;
  const titleLineHeightPx = titleFontPx * Math.max(0.8, config.title.lineHeight);
  const rawTitle = config.title.text ?? '';
  const wrappedTitle = rawTitle.trim() ? wrapTitleLines(rawTitle, contentWidthPx, titleFontCss) : [];
  // 标题最多占版心高度的六成：再多就会把二维码挤成废码，超出的行不印，由体检如实报出
  const titleLineBudget = Math.max(1, Math.floor((contentHeightPx * TITLE_MAX_HEIGHT_SHARE) / titleLineHeightPx));
  const titleLines = wrappedTitle.slice(0, titleLineBudget);
  const titleClippedLines = Math.max(0, wrappedTitle.length - titleLines.length);
  const titleHeightPx = titleLines.length * titleLineHeightPx;

  const hasTitle = titleLines.length > 0;
  const gapPx = hasTitle ? Math.round(mmToPx(config.title.gapMm, dpi)) : 0;
  const titleBlockPx = hasTitle ? titleHeightPx + gapPx : 0;
  const availableForQr = contentHeightPx - titleBlockPx;

  const qrRequestedPx = Math.max(1, Math.round(mmToPx(config.qr.sizeMm, dpi)));
  // 二维码：空间上限按毫米算（与 scale 无关），取整只在**导出网格**上做一次；
  // 预览只把这张满 DPI 位图等比缩放绘制，绝不在缩小后的 dpi 上重新取整——
  // 否则屏幕拿尺子量到的毫米会与读数条、与印出来的一直打架。
  const exportDpi = config.page.dpi;
  const contentWidthMm = pxToMm(contentWidthPx, dpi);
  const availableForQrMm = pxToMm(availableForQr, dpi);
  const qrLimitMm = Math.max(
    0.1,
    Math.min(config.qr.sizeMm, contentWidthMm || 0.1, availableForQrMm > 0 ? availableForQrMm : 0.1),
  );
  const qr = renderQrCode(config.content, qrLimitMm, exportDpi, config.qr.errorCorrectionLevel, config.qr.quietZoneModules);
  const qrActualMm = pxToMm(qr.sidePx, exportDpi);
  const qrDrawPx = Math.max(1, Math.round(mmToPx(qrActualMm, dpi)));

  // 内容块的垂直站位：留白全在下方（顶部）／上下各一半（居中）／全在上方（底部）
  const blockHeightPx = titleBlockPx + qrDrawPx;
  const freePx = Math.max(0, contentHeightPx - blockHeightPx);
  const blockTopPx =
    marginPx +
    (config.page.blockAlign === 'center'
      ? Math.round(freePx / 2)
      : config.page.blockAlign === 'bottom'
        ? freePx
        : 0);

  const titleYPx = config.title.position === 'above' || !hasTitle ? blockTopPx : blockTopPx + qrDrawPx + gapPx;
  const qrY = hasTitle && config.title.position === 'above' ? blockTopPx + titleHeightPx + gapPx : blockTopPx;
  const qrX = Math.round(marginPx + Math.max(0, (contentWidthPx - qrDrawPx) / 2));

  return {
    config,
    qr,
    layout: {
      sheetWidthMm: widthMm,
      sheetHeightMm: heightMm,
      dpi,
      pixelWidth,
      pixelHeight,
      marginPx,
      contentWidthPx,
      contentHeightPx,
      titleLines,
      titleFontPx,
      titleFontCss,
      titleLineHeightPx,
      titleHeightPx,
      titleYPx,
      gapPx,
      qrRequestedPx,
      qrSidePx: qrDrawPx,
      qrExportSidePx: qr.sidePx,
      qrModulePx: qr.modulePx,
      qrActualMm,
      qrInkMm: pxToMm(qr.modulePx * (qr.modules - 2 * Math.max(0, Math.round(config.qr.quietZoneModules))), exportDpi),
      qrModules: qr.modules,
      qrOverflow: qr.overflow,
      actualErrorCorrectionLevel: qr.level,
      titleClippedLines,
      qrX,
      qrY,
      spaceLimited: qrLimitMm < config.qr.sizeMm - 0.01,
      titleOverflow: titleBlockPx + 1 >= contentHeightPx,
    },
  };
}

/** 版式几何（毫米刻度读数都用它，scale=1 时是导出真相） */
export function layoutLabel(config: LabelConfig, scale = 1): LabelLayout {
  return build(config, scale).layout;
}

function drawCropMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number,
  dirX: number,
  dirY: number,
  thickness: number,
) {
  ctx.fillRect(dirX > 0 ? x : x - length, y, length, thickness);
  ctx.fillRect(x, dirY > 0 ? y : y - length, thickness, length);
}

function drawSheetMarks(ctx: CanvasRenderingContext2D, built: Built) {
  const { layout, config } = built;
  const { marginPx, contentWidthPx, contentHeightPx, dpi } = layout;
  const thickness = Math.max(1, Math.round(dpi / 600));
  const markLength = Math.min(mmToPx(5, dpi), marginPx * 0.5);
  const gap = Math.max(thickness * 2, marginPx * 0.22);
  const left = marginPx;
  const top = marginPx;
  const right = marginPx + contentWidthPx;
  const bottom = marginPx + contentHeightPx;

  if (config.marks.cropMarks && markLength >= mmToPx(1.5, dpi)) {
    ctx.fillStyle = INK;
    drawCropMark(ctx, left - gap, top, markLength, -1, -1, thickness);
    drawCropMark(ctx, right + gap, top, markLength, 1, -1, thickness);
    drawCropMark(ctx, left - gap, bottom, markLength, -1, 1, thickness);
    drawCropMark(ctx, right + gap, bottom, markLength, 1, 1, thickness);
  }

  if (config.marks.marginGuides) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,160,233,0.55)';
    ctx.lineWidth = thickness;
    ctx.setLineDash([mmToPx(2, dpi), mmToPx(1.5, dpi)]);
    ctx.strokeRect(left + thickness / 2, top + thickness / 2, contentWidthPx - thickness, contentHeightPx - thickness);
    ctx.restore();
  }
}

/** 色标条与规格读数：真读数，不是装饰 */
function drawColorBar(ctx: CanvasRenderingContext2D, built: Built) {
  const { layout, config } = built;
  const { dpi, marginPx, pixelWidth, pixelHeight, qrModulePx, qrModules, actualErrorCorrectionLevel } = layout;
  const bandPx = marginPx;
  if (!config.marks.colorBar || bandPx < mmToPx(6, dpi)) return;

  const cellPx = Math.max(2, Math.round(mmToPx(3.5, dpi)));
  const barWidthPx = cellPx * 8;
  const barHeightPx = Math.max(2, Math.round(Math.min(mmToPx(2.6, dpi), bandPx * 0.42)));
  const fontPx = Math.max(6, Math.round(ptToPx(5, dpi)));
  const text = `${config.page.widthMm}×${config.page.heightMm}mm · ${config.page.dpi}DPI · 模块${qrModulePx}px · ${qrModules}模块 · 纠错${actualErrorCorrectionLevel}`;

  ctx.save();
  ctx.font = `400 ${fontPx}px "Cascadia Mono", Consolas, monospace`;
  const textWidth = ctx.measureText(text).width;
  const totalWidth = Math.min(barWidthPx + textWidth + fontPx * 1.5, pixelWidth - marginPx * 2);
  const startX = Math.round((pixelWidth - totalWidth) / 2);
  const barY = Math.round(pixelHeight - bandPx + (bandPx - barHeightPx) / 2);

  const inks = [...PROCESS_INKS, '#00807a', '#7a3f00', '#007a2f', '#101010'];
  ctx.fillStyle = INK;
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = inks[i];
    ctx.fillRect(startX + i * cellPx, barY, cellPx, barHeightPx);
  }
  ctx.fillStyle = 'rgba(16,16,16,0.85)';
  ctx.fillRect(startX, barY, barWidthPx, Math.max(1, Math.round(dpi / 600)));

  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, startX + barWidthPx + fontPx, barY + barHeightPx / 2);
  ctx.restore();
}

/** 渲染整张标签（scale < 1 用于界面预览，导出永远用 scale = 1）：出不了图时用 failure 表达，绝不抛异常 */
export function renderLabel(config: LabelConfig, scale = 1, into?: HTMLCanvasElement): RenderResult {
  const built = build(config, scale);
  const { layout, qr } = built;
  // 预览会传入一张常驻画布复用：每次参数改动都新建 canvas 会让合成器反复上传大位图，
  // 还会制造大对象 GC 停顿（实测 A4 参数连击时每步 60–90ms 卡顿，贴纸尺寸则只有 11ms）
  const canvas = into ?? document.createElement('canvas');
  // 尺寸没变就不赋值：赋同值也会清整块画布，而这里本来就要全幅重绘
  if (canvas.width !== layout.pixelWidth) canvas.width = layout.pixelWidth;
  if (canvas.height !== layout.pixelHeight) canvas.height = layout.pixelHeight;
  const ctx = canvas.getContext('2d');
  // 画布分配失败（尺寸超过浏览器上限）或尺寸被浏览器夹小：显式报失败，绝不返回一张空白还当成成功
  let failure: RenderFailure | null =
    ctx && canvas.width === layout.pixelWidth && canvas.height === layout.pixelHeight
      ? qr.overflow
        ? 'qr_overflow'
        : null
      : 'canvas_unavailable';

  if (ctx && failure !== 'canvas_unavailable') {
    try {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawSheetMarks(ctx, built);

      if (layout.titleLines.length) {
        ctx.save();
        ctx.fillStyle = INK;
        ctx.font = layout.titleFontCss;
        ctx.textBaseline = 'top';
        const padding = (layout.titleLineHeightPx - layout.titleFontPx) / 2;
        layout.titleLines.forEach((line, index) => {
          if (!line) return;
          const y = Math.round(layout.titleYPx + index * layout.titleLineHeightPx + padding);
          let x = layout.marginPx;
          if (config.title.align === 'center') {
            x = Math.round(layout.marginPx + (layout.contentWidthPx - ctx.measureText(line).width) / 2);
          } else if (config.title.align === 'right') {
            x = Math.round(layout.marginPx + layout.contentWidthPx - ctx.measureText(line).width);
          }
          ctx.fillText(line, x, y);
        });
        ctx.restore();
      }

      ctx.drawImage(qr.canvas, layout.qrX, layout.qrY, layout.qrSidePx, layout.qrSidePx);
      drawColorBar(ctx, built);
    } catch {
      // 绘制中途失败（内存不足等）：按失败上报，不让异常冒到界面里把整页打白
      failure = 'canvas_unavailable';
    }
  }

  return {
    canvas,
    pixelWidth: layout.pixelWidth,
    pixelHeight: layout.pixelHeight,
    modulePx: qr.modulePx,
    qrModules: qr.modules,
    downgraded: qr.downgraded,
    actualErrorCorrectionLevel: qr.level,
    failure,
  };
}

/** 参数体检：返回人话级别的问题清单，界面按线型展示 */
export function validateLabel(config: LabelConfig, layout: LabelLayout): LabelIssue[] {
  const issues: LabelIssue[] = [];
  const dpi = layout.dpi;

  if (!config.content.trim()) {
    issues.push({ level: 'warn', message: '内容为空：二维码位置只画了占位框。' });
  }
  if (layout.qrOverflow) {
    const cap = ECL_BYTE_CAPACITY[config.qr.errorCorrectionLevel] ?? ECL_BYTE_CAPACITY.M;
    const bytes = new TextEncoder().encode(config.content).length;
    issues.push({
      level: 'error',
      message: `内容 ${bytes} 字节超出二维码容量（纠错 ${config.qr.errorCorrectionLevel} 最多 ${cap} 字节）：二维码位置只画了占位框，请缩短内容或降低纠错等级。`,
    });
  } else if (layout.actualErrorCorrectionLevel !== config.qr.errorCorrectionLevel) {
    issues.push({
      level: 'warn',
      message: `内容较长：纠错等级已由 ${config.qr.errorCorrectionLevel} 降到 ${layout.actualErrorCorrectionLevel} 才装得下，印在纸上的也是 ${layout.actualErrorCorrectionLevel}。`,
    });
  }
  if (layout.titleClippedLines > 0) {
    issues.push({
      level: 'warn',
      message: `标题过长：超出「最多占版心六成」的 ${layout.titleClippedLines} 行没有印出，请缩短标题或减小字号。`,
    });
  }
  if (layout.titleOverflow) {
    issues.push({ level: 'error', message: '标题太高，已经占满版心，二维码无处安放：缩小字号、减小行高或加大页边距。' });
  } else if (layout.spaceLimited) {
    issues.push({
      level: 'warn',
      message: `可用空间不足：二维码已由 ${config.qr.sizeMm} mm 压到 ${layout.qrActualMm.toFixed(1)} mm。`,
    });
  }
  // 整数像素取整造成的微小缩短不报警：读数条已经报出真实边长，
  // 而「模块必须是整数像素」是保证打印不发虚的前提，不是用户要改的东西。
  if (layout.qrModulePx > 0 && layout.qrModulePx < 2 && layout.qrModules > 0) {
    issues.push({ level: 'warn', message: `模块只有 ${layout.qrModulePx} 像素，打印会发虚：加大二维码边长、降低纠错等级或缩短内容。` });
  }
  if (config.qr.sizeMm <= 0) {
    issues.push({ level: 'error', message: '二维码边长必须大于 0。' });
  }
  if (layout.contentWidthPx <= 0 || layout.contentHeightPx <= 0) {
    issues.push({ level: 'error', message: '页边距把版心压没了，请减小页边距。' });
  }
  if (config.marks.colorBar && layout.marginPx < mmToPx(6, dpi)) {
    issues.push({ level: 'warn', message: '页边距不足 6 mm，色标条画不下，已忽略。' });
  }
  if (config.marks.cropMarks && layout.marginPx < mmToPx(4, dpi)) {
    issues.push({ level: 'warn', message: '页边距不足 4 mm，裁切标记画不下，已忽略。' });
  }
  const megapixels = (layout.pixelWidth * layout.pixelHeight) / 1_000_000;
  if (megapixels > MAX_RENDER_MEGAPIXELS) {
    issues.push({
      level: 'error',
      message: `导出画布 ${megapixels.toFixed(0)} 兆像素超过上限 ${MAX_RENDER_MEGAPIXELS} 兆像素：浏览器分配不出这么大的画布，请降低 DPI、缩小纸张或减小页边距。`,
    });
  } else if (megapixels > CANVAS_WARN_MEGAPIXELS) {
    issues.push({ level: 'warn', message: `当前 ${dpi} DPI 共 ${megapixels.toFixed(0)} 兆像素，导出会慢且占内存，建议降到 300 DPI。` });
  }
  return issues;
}
