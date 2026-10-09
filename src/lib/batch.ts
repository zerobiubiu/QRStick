/**
 * 批量：一份标签配置 × 多行数据 → 每条标签一份配置。
 */
import type { BatchRow, LabelConfig } from './types';

/**
 * 按数据行展开配置：用每行的标题覆盖 `config.title.text`、内容覆盖 `config.content`。
 *
 * 每条都做深拷贝（structuredClone）：不修改传入的 config，返回的各条之间也不共享
 * page / qr / title 等子对象，调用方可以单独调整某一条而不影响其他标签。
 */
export function buildBatch(config: LabelConfig, rows: BatchRow[]): LabelConfig[] {
  return rows.map((row) => {
    const label = structuredClone(config);
    label.title.text = row.title;
    label.content = row.content;
    return label;
  });
}
