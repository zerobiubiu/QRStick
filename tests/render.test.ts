/**
 * 渲染核的边界纪律：内容超容量、画布超上限、超长标题、纠错回退都必须**如实上报**，
 * 并且版式路径绝不抛异常（抛出去会把整页打白——本轮加固前实测过一次）。
 *
 * 无 DOM 环境里 measureWidth 退回按字数估算，所以这里只测版式与体检口径；
 * 画布本身的行为（占位框、分配失败、不白屏）由浏览器冒烟与导出隔离测试覆盖。
 */
import { describe, expect, test } from 'bun:test';

// 无 DOM 环境：给一张「上下文恒为 null」的假画布。渲染核必须容忍拿不到 2D 上下文
// （只算版式与几何、不绘制），所以这里能测容量、毫米与体检口径。
Object.assign(globalThis, {
  document: { createElement: () => ({ width: 0, height: 0, getContext: () => null }) },
});

import { layoutLabel, validateLabel } from '../src/lib/render';
import { DEFAULT_CONFIG } from '../src/state/persistence';
import type { ErrorCorrectionLevel, LabelConfig } from '../src/lib/types';

const make = (patch: (config: LabelConfig) => void): LabelConfig => {
  const config = structuredClone(DEFAULT_CONFIG);
  patch(config);
  return config;
};

const issuesOf = (config: LabelConfig) => validateLabel(config, layoutLabel(config));
const errorsOf = (config: LabelConfig) => issuesOf(config).filter((issue) => issue.level === 'error');
const textsOf = (config: LabelConfig) => issuesOf(config).map((issue) => issue.message).join('\n');

describe('默认参数', () => {
  test('默认印张没有任何 error 级问题', () => {
    expect(errorsOf(make(() => {}))).toEqual([]);
  });

  test('默认印张不受容量、兆像素与标题裁切的新检查影响', () => {
    const text = textsOf(make(() => {}));
    expect(text).not.toContain('超出二维码容量');
    expect(text).not.toContain('兆像素超过上限');
    expect(text).not.toContain('标题过长');
  });
});

describe('二维码容量', () => {
  test('装得下：短内容不报超容量，也不降级', () => {
    const layout = layoutLabel(make((config) => {
      config.content = 'x'.repeat(100);
    }));
    expect(layout.qrOverflow).toBe(false);
    expect(layout.actualErrorCorrectionLevel).toBe('M');
  });

  test('装不下：四级全失败时标记 overflow 并按 error 报出真实字节数与上限', () => {
    const config = make((c) => {
      c.content = 'x'.repeat(4000); // 字节模式上限（L 级 2953）也装不下
    });
    const layout = layoutLabel(config);
    expect(layout.qrOverflow).toBe(true);
    const message = textsOf(config);
    expect(message).toContain('超出二维码容量');
    expect(message).toContain('4000 字节');
    expect(errorsOf(config).length).toBeGreaterThan(0);
  });

  test('内容较长：纠错等级如实降到实际使用的那一级', () => {
    const config = make((c) => {
      c.content = 'x'.repeat(1500); // H（1273）装不下，M（2331）装得下
      c.qr.errorCorrectionLevel = 'H';
    });
    const layout = layoutLabel(config);
    expect(layout.actualErrorCorrectionLevel).not.toBe('H');
    expect(layout.qrOverflow).toBe(false);
    expect(textsOf(config)).toContain('降到');
  });

  test('纠错等级写成非法值时不抛异常，回落到 M 起步的完整回退顺序', () => {
    const layout = layoutLabel(make((c) => {
      c.content = 'x'.repeat(50);
      c.qr.errorCorrectionLevel = 'X' as ErrorCorrectionLevel;
    }));
    expect(layout.actualErrorCorrectionLevel).toBe('M');
  });

  test('空内容：给占位框而不是超容量', () => {
    const layout = layoutLabel(make((c) => {
      c.content = '';
    }));
    expect(layout.qrOverflow).toBe(false);
    expect(textsOf(make((c) => { c.content = ''; }))).toContain('内容为空');
  });
});

describe('标题与画布边界', () => {
  test('超长标题：裁掉的行数如实上报，且二维码不再被挤成废码', () => {
    const config = make((c) => {
      c.title.text = '库位'.repeat(3000); // 6000 字：任何测量口径下都会远超「最多占版心六成」
    });
    const layout = layoutLabel(config);
    expect(layout.titleClippedLines).toBeGreaterThan(0);
    expect(textsOf(config)).toContain('标题过长');
    // 标题最多占版心六成，二维码至少留四成高度：A4 版心 273mm，请求 60mm 时必须拿到请求值
    expect(layout.qrActualMm).toBeGreaterThanOrEqual(50);
  });

  test('画布超上限：按 error 拦下（浏览器分配不出这么大的画布）', () => {
    const config = make((c) => {
      c.page.presetId = 'custom';
      c.page.widthMm = 2000;
      c.page.heightMm = 2000;
      c.page.dpi = 600;
    });
    expect(textsOf(config)).toContain('兆像素超过上限');
    expect(errorsOf(config).length).toBeGreaterThan(0);
  });

  test('A4@600 仍在提示线以下：不误报 error', () => {
    const config = make((c) => {
      c.page.dpi = 600;
    });
    expect(errorsOf(config)).toEqual([]);
  });
});