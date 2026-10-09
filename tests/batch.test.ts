/**
 * 「行 → 配置」的唯一实现的守卫。
 *
 * 这里盯的是**别名**这一类真实缺陷：旧实现里批量预览用的是浅拷贝 + 新 title，
 * 各行的 page / qr / marks 与基准配置是同一个对象——任何一处就地改动都会串到别处。
 */
import { describe, expect, test } from 'bun:test';
import { buildBatch, buildRowConfig } from '../src/lib/batch';
import { DEFAULT_CONFIG } from '../src/state/persistence';
import type { BatchRow } from '../src/lib/types';

const row = (index: number, title: string, content: string): BatchRow => ({ index, title, content });

describe('buildRowConfig', () => {
  test('用一行数据覆盖标题与内容，且不修改传入的配置', () => {
    const base = structuredClone(DEFAULT_CONFIG);
    const next = buildRowConfig(base, row(1, '库位 B-01', 'LOC-B-01'));

    expect(next.title.text).toBe('库位 B-01');
    expect(next.content).toBe('LOC-B-01');
    expect(base.title.text).toBe(DEFAULT_CONFIG.title.text);
    expect(base.content).toBe(DEFAULT_CONFIG.content);
  });

  test('深拷贝：返回的对象不与基准配置共享任何子对象', () => {
    const base = structuredClone(DEFAULT_CONFIG);
    const next = buildRowConfig(base, row(1, 'A', 'a'));

    expect(next.page).not.toBe(base.page);
    expect(next.qr).not.toBe(base.qr);
    expect(next.title).not.toBe(base.title);
    expect(next.marks).not.toBe(base.marks);

    // 就地改动返回对象，基准配置必须纹丝不动（浅拷贝在这里会失败）
    next.page.marginMm = 99;
    next.qr.sizeMm = 1;
    next.marks.colorBar = false;
    next.title.fontSizePt = 4;

    expect(base.page.marginMm).toBe(DEFAULT_CONFIG.page.marginMm);
    expect(base.qr.sizeMm).toBe(DEFAULT_CONFIG.qr.sizeMm);
    expect(base.marks.colorBar).toBe(DEFAULT_CONFIG.marks.colorBar);
    expect(base.title.fontSizePt).toBe(DEFAULT_CONFIG.title.fontSizePt);
  });
});

describe('buildBatch', () => {
  test('逐行展开且保持顺序', () => {
    const base = structuredClone(DEFAULT_CONFIG);
    const rows = [row(1, 'A', 'a'), row(2, 'B', 'b'), row(3, 'C', 'c')];
    const out = buildBatch(base, rows);

    expect(out).toHaveLength(3);
    expect(out.map((item) => item.title.text)).toEqual(['A', 'B', 'C']);
    expect(out.map((item) => item.content)).toEqual(['a', 'b', 'c']);
  });

  test('各行之间互不共享子对象', () => {
    const base = structuredClone(DEFAULT_CONFIG);
    const [one, two] = buildBatch(base, [row(1, 'A', 'a'), row(2, 'B', 'b')]);

    expect(one.page).not.toBe(two.page);
    one.page.dpi = 72;
    expect(two.page.dpi).toBe(DEFAULT_CONFIG.page.dpi);
  });

  test('空行输入得到空数组（不抛错）', () => {
    expect(buildBatch(DEFAULT_CONFIG, [])).toEqual([]);
  });
});