/**
 * 导出叶子模块：把已经渲染好的画布 / 位图落成 PNG、PDF、Word 三种可下载文件。
 *
 * 这里不做任何渲染，也不读 LabelConfig：画布（PNG、PDF）由 renderLabel 产出、
 * 二维码位图（Word）由调用方按同一套毫米参数产出。毫米是唯一的版面真相，
 * 各格式内部单位的换算只发生在本文件里。
 */
import { jsPDF } from 'jspdf';
import {
  AlignmentType,
  Document,
  ImageRun,
  PageOrientation,
  Packer,
  Paragraph,
  TextRun,
  convertMillimetersToTwip,
} from 'docx';
import { canvasToPngBlob, sanitizeFileName, saveBlob } from './download';
import { resolveLabelFont } from './fonts';
import { MM_PER_INCH } from './units';

/** 一页待导出的画布：宽高是毫米，像素数由渲染时的 DPI 决定 */
export interface ExportPage {
  canvas: HTMLCanvasElement;
  widthMm: number;
  heightMm: number;
}

/** 标题对齐 → docx 的段落对齐 */
const ALIGNMENT_BY_ALIGN = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
} as const;

/** 导出一张 PNG：按画布原像素下载（就是导出 DPI 下的像素） */
export async function exportPng(page: ExportPage, fileName: string): Promise<void> {
  saveBlob(await canvasToPngBlob(page.canvas), `${sanitizeFileName(fileName)}.png`);
}

/** 导出一个 PDF：每页尺寸 = 传入的毫米尺寸，图片 0,0 铺满整页 */
export async function exportPdf(pages: ExportPage[], fileName: string): Promise<void> {
  const builder = createPdfBuilder();
  for (const page of pages) {
    builder.addPage(page);
  }
  builder.save(fileName);
}

/**
 * 逐页写出的 PDF 构造器。
 *
 * 批量出码时页面是一张张现渲染的：全部画布留在内存里会直接把标签页撑爆
 * （A4 300 DPI 一页就是 35 MB），所以这里按页喂进来、喂完就让调用方回收画布。
 */
export interface PdfBuilder {
  /** 追加一页；图像数据当场写进文档，之后画布可以释放。返回 false 表示这一页没编码出来，未写入 */
  addPage(page: ExportPage): boolean;
  save(fileName: string): void;
}

export function createPdfBuilder(): PdfBuilder {
  let doc: jsPDF | null = null;
  return {
    addPage(page) {
      // 先把这一页编码成 PNG：编码失败（画布已被回收、内存不足等）只跳过这一页，
      // 绝不能让它把整份文档连坐作废
      let dataUrl: string;
      try {
        dataUrl = page.canvas.toDataURL('image/png');
      } catch {
        return false;
      }
      // jsPDF 的 format 数组永远按纵向解释（短边在前），横向页面靠 orientation 摆正：
      // 这样 210×297 与 297×210 才会各自落到正确的页面尺寸上
      const landscape = page.widthMm > page.heightMm;
      const format = landscape ? [page.heightMm, page.widthMm] : [page.widthMm, page.heightMm];
      if (!doc) {
        doc = new jsPDF({
          unit: 'mm',
          format,
          orientation: landscape ? 'landscape' : 'portrait',
          compress: true,
        });
      } else {
        doc.addPage(format, landscape ? 'landscape' : 'portrait');
      }
      doc.addImage(
        dataUrl,
        'PNG',
        0,
        0,
        page.widthMm,
        page.heightMm,
        undefined,
        'FAST', // Flate 无损压缩：二维码模块要清晰，文件也别太肥
      );
      return true;
    },
    save(fileName) {
      if (!doc) return; // 一页都没写进去就不生成文件，免得留下空文档
      saveBlob(doc.output('blob'), `${sanitizeFileName(fileName)}.pdf`);
    },
  };
}

/** 一节 Word 页面上要放的内容：标题是真实文字，二维码是调用方渲染好的位图 */
export interface WordPage {
  title: string;
  qrPng: Uint8Array;
  qrSizeMm: number;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  fontId: string;
  fontSizePt: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  position: 'above' | 'below';
  gapMm: number;
}

/** 导出 Word：每页一节，页面尺寸与边距按毫米传入，标题可继续编辑 */
export async function exportWord(pages: WordPage[], fileName: string): Promise<void> {
  const sections = pages.map((page) => {
    const font = resolveLabelFont(page.fontId);
    // 画布渲染会把边距夹到「半页 - 1mm」以内，这里保持一致，免得 Word 自己改版心
    const marginMm = Math.max(0, Math.min(page.marginMm, Math.min(page.widthMm, page.heightMm) / 2 - 1));
    const marginTwips = convertMillimetersToTwip(marginMm);
    const gapTwips = convertMillimetersToTwip(page.gapMm);
    // ImageRun 的 transformation 单位是 96dpi 的像素，按毫米换算过去
    const qrPx = Math.max(1, Math.round((page.qrSizeMm * 96) / MM_PER_INCH));
    // 画布渲染里标题为空就不占行、不留间距，Word 保持一致
    const hasTitle = page.title.trim().length > 0;

    const titleParagraph = new Paragraph({
      alignment: ALIGNMENT_BY_ALIGN[page.align],
      // 间距只写在标题段落上，避免 Word 把前后间距叠加成两倍
      spacing: page.position === 'above' ? { after: gapTwips } : { before: gapTwips },
      children: [
        new TextRun({
          text: page.title,
          font: {
            ascii: font.docxName,
            eastAsia: font.docxName,
            hAnsi: font.docxName,
            cs: font.docxName,
          },
          size: page.fontSizePt * 2, // docx 的字号单位是半点
          bold: page.bold,
        }),
      ],
    });
    const qrParagraph = new Paragraph({
      // 画布渲染里二维码始终在版心里居中，对齐只作用于标题
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: 'png',
          data: page.qrPng,
          transformation: { width: qrPx, height: qrPx },
        }),
      ],
    });

    // docx 的 page.size 以纵向为基准：横向页面交换宽高，方向另行标注
    const landscape = page.widthMm > page.heightMm;
    return {
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(landscape ? page.heightMm : page.widthMm),
            height: convertMillimetersToTwip(landscape ? page.widthMm : page.heightMm),
            orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
          },
          margin: {
            top: marginTwips,
            right: marginTwips,
            bottom: marginTwips,
            left: marginTwips,
          },
        },
      },
      children:
        hasTitle && page.position === 'above'
          ? [titleParagraph, qrParagraph]
          : hasTitle
            ? [qrParagraph, titleParagraph]
            : [qrParagraph],
    };
  });

  if (sections.length === 0) return; // 没有页面就没有文件

  saveBlob(await Packer.toBlob(new Document({ sections })), `${sanitizeFileName(fileName)}.docx`);
}
