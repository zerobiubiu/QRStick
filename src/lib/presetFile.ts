/**
 * 预设文件：把本机的样式 / 规格预设变成一个能带走的 JSON 文件。
 *
 * 文件形状（v1）：
 * ```json
 * {
 *   "app": "qrstick",
 *   "kind": "presets",
 *   "version": 1,
 *   "exportedAt": "2026-10-09 17:05:00",
 *   "presets": [{ "name": "A4 工单", "scope": "full", "savedAt": "…", "config": { … } }]
 * }
 * ```
 *
 * 解析故意宽容：裸数组（`[预设…]` 或 `[{配置}…]`）也接受；缺字段交给调用方按默认值补齐；
 * 结构不对的条目跳过并记一条提醒，而不是让整个文件解析失败——现场文件常常是手改过的。
 */
import type { LabelConfig, PresetScope } from './types';

export interface PresetFileEntry {
  name: string;
  scope: PresetScope;
  savedAt: string;
  config: Partial<LabelConfig>;
}

export interface PresetFileParse {
  entries: PresetFileEntry[];
  warnings: string[];
}

const SCOPES: PresetScope[] = ['full', 'style'];

function readEntry(value: unknown, index: number, warnings: string[]): PresetFileEntry | null {
  if (!value || typeof value !== 'object') {
    warnings.push(`第 ${index + 1} 条不是对象，已跳过`);
    return null;
  }
  const record = value as { name?: unknown; scope?: unknown; savedAt?: unknown; config?: unknown };
  const config = record.config && typeof record.config === 'object' ? (record.config as Partial<LabelConfig>) : null;
  if (!config) {
    warnings.push(`第 ${index + 1} 条没有 config，已跳过`);
    return null;
  }
  const scope = SCOPES.includes(record.scope as PresetScope) ? (record.scope as PresetScope) : 'full';
  return {
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : `导入预设 ${index + 1}`,
    scope,
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : '',
    config,
  };
}

export function parsePresetFile(text: string): PresetFileParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('不是合法的 JSON 文件');
  }

  const warnings: string[] = [];
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { presets?: unknown }).presets)
      ? ((parsed as { presets: unknown[] }).presets as unknown[])
      : Array.isArray((parsed as { config?: unknown })?.config)
        ? [parsed]
        : null;

  if (!list) {
    throw new Error('文件里没有预设列表：期望 { app:"qrstick", kind:"presets", presets:[…] } 或一个数组');
  }
  if (Array.isArray(parsed) && parsed.length > 0 && !(parsed[0] as { config?: unknown })?.config) {
    // 裸配置数组：整份文件就是一个配置的情况（例如手写的单套样式）
    const single = readEntry({ name: '导入的样式', config: parsed }, 0, warnings);
    return { entries: single ? [single] : [], warnings };
  }

  const entries: PresetFileEntry[] = [];
  list.forEach((item, index) => {
    const entry = readEntry(item, index, warnings);
    if (entry) entries.push(entry);
  });
  if (entries.length === 0 && warnings.length === 0) warnings.push('文件里没有任何预设');
  return { entries, warnings };
}

export function buildPresetFile(presets: PresetFileEntry[]): string {
  return `${JSON.stringify(
    {
      app: 'qrstick',
      kind: 'presets',
      version: 1,
      exportedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      presets,
    },
    null,
    2,
  )}\n`;
}