/**
 * CSV 导入解析（批量数据的入口）。
 *
 * 解析规则为手写 RFC4180：字段可用双引号包裹，包裹后内部的逗号 / 换行原样保留，
 * `""` 转义为一个双引号；行尾支持 LF / CRLF / CR，文件末尾的换行不产生空记录。
 *
 * 编码规则：先按 UTF-8 解码，出现替换字符（U+FFFD）说明字节不是 UTF-8，
 * 改按 GBK 重解——中文 Windows 的 Excel 另存 CSV 默认就是 GBK；解码后去掉 BOM。
 *
 * 表头规则：首行同时出现「标题 / title」与「内容 / content / 文本 / text」两列时按列名取值
 * （列序不限），否则视为无表头：第 1 列 = 标题、第 2 列 = 内容，只有一列时标题 = 内容。
 */
import type { BatchRow } from './types';

export interface CsvParse {
  rows: BatchRow[];
  warnings: string[];
  encoding: 'utf-8' | 'gbk';
  hasHeader: boolean;
}

/**
 * 纯文本解析：返回全部记录（含空行），不做表头与业务判断，便于测试直接喂字符串。
 */
export function parseCsvText(text: string): { rows: string[][] } {
  const rows: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let recordStarted = false; // 当前记录自上一个换行以来是否出现过内容（含打开的引号）

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // "" 转义为一个双引号
          i += 1;
        } else {
          inQuotes = false; // 引号闭合，字段结束
        }
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[i + 1] === '\n') i += 1; // CRLF 记作一次换行
        field += '\n'; // 字段内换行统一成 \n，免得标题里混进 \r
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true; // 只在字段开头识别包裹引号，字段中间的裸引号按普通字符处理
      recordStarted = true;
      continue;
    }

    if (char === ',') {
      record.push(field);
      field = '';
      recordStarted = true;
      continue;
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1; // CRLF 视作一次换行
      record.push(field);
      rows.push(record);
      record = [];
      field = '';
      recordStarted = false;
      continue;
    }

    field += char;
    recordStarted = true;
  }

  // 文件末尾没有换行符时补上最后一条记录；末尾换行不会产生空记录
  if (recordStarted) {
    record.push(field);
    rows.push(record);
  }

  return { rows };
}

/** 读取文件字节并按 UTF-8 → GBK 的顺序解码，返回文本与实际编码 */
async function decodeCsvFile(file: File): Promise<{ text: string; encoding: 'utf-8' | 'gbk' }> {
  const bytes = await file.arrayBuffer();
  let encoding: 'utf-8' | 'gbk' = 'utf-8';
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('\uFFFD')) {
    // UTF-8 解出替换字符 → 几乎可以肯定不是 UTF-8，按 GBK 重解
    encoding = 'gbk';
    text = new TextDecoder('gbk').decode(bytes);
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // 去掉 BOM
  return { text, encoding };
}

/**
 * 解析 CSV 文件：识别编码与表头，产出批量数据行。
 *
 * - 全空行直接跳过：不占序号、不报警告；
 * - 内容为空的行记入 warnings 并跳过（标题允许为空）；
 * - 映射时去掉字段首尾空白：Excel 常在单元格里留下看不见的空格，而二维码内容末尾多一个空格就扫不出来；
 * - BatchRow.index 是结果里的序号（从 1 开始，被跳过的行不占号）；warnings 里报的是文件行号，方便回原文件定位；
 * - 文件超过两列时忽略多余列，并记一条警告。
 */
export async function parseCsvFile(file: File): Promise<CsvParse> {
  const { text, encoding } = await decodeCsvFile(file);
  const parsed = parseCsvText(text).rows;
  const warnings: string[] = [];

  const columnCount = parsed.reduce((widest, fields) => Math.max(widest, fields.length), 0);
  if (columnCount > 2) {
    warnings.push(`CSV 有 ${columnCount} 列，仅使用标题、内容两列，其余列已忽略`);
  }

  // 表头识别：首行同时出现标题列与内容列才按列名取值
  let hasHeader = false;
  let titleColumn = 0;
  let contentColumn = 1;
  if (parsed.length > 0) {
    const titleIndex = parsed[0].findIndex((cell) => /标题|title/i.test(cell));
    const contentIndex = parsed[0].findIndex((cell) => /内容|content|文本|text/i.test(cell));
    if (titleIndex >= 0 && contentIndex >= 0 && titleIndex !== contentIndex) {
      hasHeader = true;
      titleColumn = titleIndex;
      contentColumn = contentIndex;
    }
  }

  const rows: BatchRow[] = [];
  const dataRows = hasHeader ? parsed.slice(1) : parsed;
  dataRows.forEach((fields, i) => {
    if (fields.every((cell) => cell.trim() === '')) return; // 全空行（含只剩逗号的行）不产生数据
    let title: string;
    let content: string;
    if (hasHeader) {
      title = (fields[titleColumn] ?? '').trim();
      content = (fields[contentColumn] ?? '').trim();
    } else if (fields.length === 1) {
      title = fields[0].trim();
      content = title; // 只有一列时标题 = 内容
    } else {
      title = fields[0].trim();
      content = fields[1].trim();
    }
    if (content === '') {
      warnings.push(`CSV 第 ${i + 1} 行内容为空，已跳过`);
      return;
    }
    rows.push({ index: rows.length + 1, title, content });
  });

  return { rows, warnings, encoding, hasHeader };
}

/**
 * 示例 CSV（UTF-8 / LF）：6 行库位 + 物料编号样式的合成数据，可直接另存为 .csv 再导入。
 */
export function buildSampleCsv(): string {
  return [
    '标题,内容',
    'A区-01排-01位,M-WH-A0101',
    'A区-01排-02位,M-WH-A0102',
    'A区-02排-01位,M-WH-A0201',
    'B区-01排-01位,M-WH-B0101',
    'B区-02排-03位,M-WH-B0203',
    'C区-03排-02位,M-WH-C0302',
  ].join('\n') + '\n';
}
