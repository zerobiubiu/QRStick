/**
 * 本机持久化的守卫：默认值、兜底与合并规则。
 *
 * `DEFAULT_VIEW.imageExport` 的默认值（批量默认打包 ZIP、拼接 3 列 2mm）是**用户默认行为**，
 * 改动它等于改产品行为；`previewZoom` / `splitRatio` / `previewColumns` 的钳制与回退同理。
 */
import { beforeEach, describe, expect, test } from 'bun:test';

// persistence 只在函数里读 localStorage（模块加载期间不读），所以这里可以在 import 之后仍生效
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  },
});

const { CONFIG_KEY, ROWS_KEY, PRESETS_KEY, VIEW_KEY, DEFAULT_CONFIG, DEFAULT_VIEW, loadInitialState } = await import(
  '../src/state/persistence'
);

beforeEach(() => {
  store.clear();
});

describe('空存储', () => {
  test('四份状态都退回默认值', () => {
    const initial = loadInitialState();
    expect(initial.config).toEqual(DEFAULT_CONFIG);
    expect(initial.rows).toEqual([]);
    expect(initial.batch).toBeNull();
    expect(initial.presets).toEqual([]);
    expect(initial.view).toEqual(DEFAULT_VIEW);
  });

  test('导出默认是「打包 ZIP」，拼接默认 3 列、间距 2mm（用户默认行为，不得随手改）', () => {
    expect(DEFAULT_VIEW.imageExport.mode).toBe('zip');
    expect(DEFAULT_VIEW.imageExport.stitch.columns).toBe(3);
    expect(DEFAULT_VIEW.imageExport.stitch.gapMm).toBe(2);
  });
});

describe('坏数据与半截结构', () => {
  test('无法解析的 JSON 不抛错，退回默认值', () => {
    store.set(CONFIG_KEY, '{ not json');
    store.set(VIEW_KEY, 'nope');
    const initial = loadInitialState();
    expect(initial.config).toEqual(DEFAULT_CONFIG);
    expect(initial.view).toEqual(DEFAULT_VIEW);
  });

  test('配置缺字段时逐组回落默认值', () => {
    store.set(CONFIG_KEY, JSON.stringify({ page: { dpi: 72 }, content: 'X' }));
    const { config } = loadInitialState();
    expect(config.page.dpi).toBe(72);
    expect(config.page.marginMm).toBe(DEFAULT_CONFIG.page.marginMm);
    expect(config.qr).toEqual(DEFAULT_CONFIG.qr);
    expect(config.content).toBe('X');
  });

  test('界面状态越界时钳制或回退', () => {
    store.set(VIEW_KEY, JSON.stringify({ previewZoom: 9, splitRatio: 0.95, previewColumns: 7, previewLayout: 'nope' }));
    const { view } = loadInitialState();
    expect(view.previewZoom).toBe(3);
    expect(view.splitRatio).toBe(0.75);
    expect(view.previewColumns).toBe('auto');
    expect(view.previewLayout).toBe('grid');
  });

  test('previewZoom 低于 1 时回退到 1', () => {
    store.set(VIEW_KEY, JSON.stringify({ previewZoom: 0 }));
    expect(loadInitialState().view.previewZoom).toBe(1);
  });
});

describe('批量行与预设的过滤', () => {
  test('缺 content 的行被丢掉，序号按顺序重排', () => {
    store.set(ROWS_KEY, JSON.stringify({ rows: [{ title: 'A', content: 'a' }, { title: 'B' }, { title: 'C', content: 'c' }] }));
    const { rows } = loadInitialState();
    expect(rows).toEqual([
      { index: 1, title: 'A', content: 'a' },
      { index: 2, title: 'C', content: 'c' },
    ]);
  });

  test('缺 id 或 config 的预设被丢掉，scope 归一', () => {
    store.set(
      PRESETS_KEY,
      JSON.stringify([
        { id: 'p1', name: '甲', config: DEFAULT_CONFIG, scope: 'style' },
        { name: '乙', config: DEFAULT_CONFIG },
        { id: 'p3', name: '丙', config: DEFAULT_CONFIG, scope: '怪值' },
      ]),
    );
    const { presets } = loadInitialState();
    expect(presets.map((preset) => preset.id)).toEqual(['p1', 'p3']);
    expect(presets.map((preset) => preset.scope)).toEqual(['style', 'full']);
  });
});