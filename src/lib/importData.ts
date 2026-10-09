/**
 * 批量数据导入：CSV / TSV / TXT / JSON / XLSX，以及直接粘贴。
 *
 * 现场数据几乎都从 Excel 出来，所以入口按「文件实际长什么样」分派：
 *  - 分隔文本（.csv/.tsv/.txt）：自动嗅探分隔符（制表符 / 逗号 / 分号 / 竖线），
 *    手写 RFC4180（引号包裹、字段内换行、`""` 转义）；先按 UTF-8 解码，出现替换字符改按 GBK
 *    （中文 Windows 的 Excel 另存 CSV 默认 GBK），并去掉 BOM；
 *  - .json：顶层数组，元素是对象（键当表头）或数组；
 *  - .xlsx：读第 1 张工作表，多表时提醒；
 *  - 粘贴：Excel 复制出来就是「制表符分隔」，复用同一条解析路。
 *
 * 表头规则：首行同时出现 标题/title 与 内容/content/文本/text 两列时按列名取值（列序不限）；
 * 否则视为无表头：第 1 列 = 标题、第 2 列 = 内容，只有一列时标题 = 内容。
 */
import readXlsxFile from 'read-excel-file/browser';
import type { BatchRow } from './types';

export type DataFormat = 'csv' | 'tsv' | 'txt' | 'json' | 'xlsx' | 'paste';

export interface DataParse {
  rows: BatchRow[];
  warnings: string[];
  /** 分隔文本才有意义；JSON / XLSX 固定报 utf-8 */
  encoding: 'utf-8' | 'gbk';
  hasHeader: boolean;
  format: DataFormat;
}

export const DATA_FORMAT_LABEL: Record<DataFormat, string> = {
  csv: 'CSV',
  tsv: 'TSV',
  txt: 'TXT',
  json: 'JSON',
  xlsx: 'XLSX',
  paste: '粘贴',
};

const DELIMITERS = ['\t', ',', ';', '|'];

/** 分隔文本解析：RFC4180，返回全部记录（含空行），不做表头与业务判断 */
export function parseDelimitedText(text: string, delimiter = ','): { rows: string[][] } {
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

    if (char === delimiter) {
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

/** 嗅探分隔符：看前几行里哪个候选符在引号外出现得最多（一个都不出现时按逗号） */
export function sniffDelimiter(text: string): string {
  const head = text.split(/\r\n|\r|\n/).slice(0, 8).join('\n');
  let best = ',';
  let bestCount = 0;
  for (const candidate of DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < head.length; i += 1) {
      if (head[i] === '"') {
        inQuotes = !inQuotes;
      } else if (!inQuotes && head[i] === candidate) {
        count += 1;
      }
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** 读取文件字节并按 UTF-8 → GBK 的顺序解码，返回文本与实际编码 */
async function decodeFile(file: File): Promise<{ text: string; encoding: 'utf-8' | 'gbk' }> {
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

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('sv-SE'); // YYYY-MM-DD
  return String(value);
}

/**
 * 二维矩阵 → 数据行：识别表头、跳过空行、给出行号级提醒。
 *
 * - 全空行直接跳过：不占序号、不报警告；
 * - 内容为空的行记入 warnings 并跳过（标题允许为空）；
 * - 映射时去掉字段首尾空白：Excel 常在单元格里留下看不见的空格，而二维码内容末尾多一个空格就扫不出来；
 * - BatchRow.index 是结果里的序号（从 1 开始，被跳过的行不占号）；warnings 里报的是数据行号，方便回原文件定位；
 * - 超过两列时忽略多余列，并记一条警告。
 */
function toBatchRows(
  matrix: string[][],
  assumeHeader = false,
): { rows: BatchRow[]; warnings: string[]; hasHeader: boolean } {
  const warnings: string[] = [];
  const columnCount = matrix.reduce((widest, fields) => Math.max(widest, fields.length), 0);
  if (columnCount > 2) {
    warnings.push(`数据有 ${columnCount} 列，仅使用标题、内容两列，其余列已忽略`);
  }

  // 表头识别：首行同时出现标题列与内容列才按列名取值；JSON 对象数组是有表头的，强制按表头处理
  let hasHeader = false;
  let titleColumn = 0;
  let contentColumn = 1;
  if (matrix.length > 0) {
    const titleIndex = matrix[0].findIndex((cell) => /标题|title/i.test(cell));
    const contentIndex = matrix[0].findIndex((cell) => /内容|content|文本|text/i.test(cell));
    if (titleIndex >= 0 && contentIndex >= 0 && titleIndex !== contentIndex) {
      hasHeader = true;
      titleColumn = titleIndex;
      contentColumn = contentIndex;
    } else if (assumeHeader) {
      hasHeader = true;
    }
  }

  const rows: BatchRow[] = [];
  const dataRows = hasHeader ? matrix.slice(1) : matrix;
  dataRows.forEach((fields, i) => {
    if (fields.every((cell) => cell.trim() === '')) return; // 全空行（含只剩分隔符的行）不产生数据
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
      warnings.push(`第 ${i + 1} 行内容为空，已跳过`);
      return;
    }
    rows.push({ index: rows.length + 1, title, content });
  });

  return { rows, warnings, hasHeader };
}

function jsonToMatrix(value: unknown): { matrix: string[][]; objects: boolean } {
  if (!Array.isArray(value)) {
    throw new Error('JSON 顶层要是数组：对象数组 [{标题, 内容}, …] 或二维数组 [["标题","内容"], …]');
  }
  if (value.length === 0) return { matrix: [], objects: false };
  const first = value[0];
  if (Array.isArray(first)) {
    return { matrix: (value as unknown[][]).map((row) => row.map(cellToText)), objects: false };
  }
  if (typeof first === 'object' && first !== null) {
    const rows = value as Record<string, unknown>[];
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    return { matrix: [keys, ...rows.map((row) => keys.map((key) => cellToText(row[key])))], objects: true };
  }
  throw new Error('JSON 里每一行要么是对象，要么是数组');
}

async function parseXlsxFile(file: File): Promise<DataParse> {
  const sheets = await readXlsxFile(file);
  const warnings: string[] = [];
  if (sheets.length > 1) {
    warnings.push(`工作簿有 ${sheets.length} 张工作表，只读了第 1 张「${sheets[0]?.sheet ?? ''}」`);
  }
  const matrix = (sheets[0]?.data ?? []).map((row) => row.map(cellToText));
  const mapped = toBatchRows(matrix);
  return { ...mapped, warnings: [...warnings, ...mapped.warnings], encoding: 'utf-8', format: 'xlsx' };
}

async function parseJsonFile(file: File): Promise<DataParse> {
  const { text } = await decodeFile(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON 解析失败：文件里不是合法的 JSON');
  }
  const { matrix, objects } = jsonToMatrix(parsed);
  const mapped = toBatchRows(matrix, objects);
  return { ...mapped, encoding: 'utf-8', format: 'json' };
}

/** 按文件类型分派：xlsx / json 走各自解析，其余按分隔文本（分隔符嗅探，.tsv 固定制表符） */
export async function parseDataFile(file: File): Promise<DataParse> {
  const name = file.name.toLowerCase();
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  if (extension === 'xlsx') return parseXlsxFile(file);
  if (extension === 'json') return parseJsonFile(file);
  if (extension === 'xls') {
    throw new Error('不支持老式 .xls（二进制格式）：请用 Excel 另存为 .xlsx 或 .csv 再导入');
  }
  const { text, encoding } = await decodeFile(file);
  const delimiter = extension === 'tsv' ? '\t' : sniffDelimiter(text);
  const format: DataFormat = extension === 'tsv' ? 'tsv' : extension === 'txt' ? 'txt' : 'csv';
  const mapped = toBatchRows(parseDelimitedText(text, delimiter).rows);
  return { ...mapped, encoding, format };
}

/** 直接粘贴：Excel 复制出来的就是制表符分隔，和分隔文本走同一条路 */
export function parsePastedText(text: string): DataParse {
  if (text.trim() === '') throw new Error('粘贴的内容是空的');
  const mapped = toBatchRows(parseDelimitedText(text, sniffDelimiter(text)).rows);
  return { ...mapped, encoding: 'utf-8', format: 'paste' };
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