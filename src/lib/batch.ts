/**
 * 批量：一份标签配置 × 多行数据 → 每条标签一份配置。
 */
import type { BatchRow, LabelConfig } from './types';

/**
 * 用一行数据覆盖一份配置：标题覆盖 `config.title.text`、内容覆盖 `config.content`。
 *
 * 深拷贝（structuredClone）：不修改传入的 config，返回的对象也不与它共享
 * page / qr / title / marks 等子对象——预览、导出、拼接任何一处调整都不会污染别处。
 *
 * 这是「行 → 配置」的唯一实现：批量导出与批量预览都必须走它，不要再各写一份
 * （曾经预览侧是浅拷贝的私版，导出侧是深拷贝的私版，同一规则两套语义）。
 */
export function buildRowConfig(config: LabelConfig, row: BatchRow): LabelConfig {
  const label = structuredClone(config);
  label.title.text = row.title;
  label.content = row.content;
  return label;
}

/** 按数据行展开配置；每一行都由 `buildRowConfig` 产出 */
export function buildBatch(config: LabelConfig, rows: BatchRow[]): LabelConfig[] {
  return rows.map((row) => buildRowConfig(config, row));
}