/**
 * 联单字段原语的输出契约（服务端渲染断言，不需要 jsdom）。
 *
 * 盯两件容易悄悄坏掉的事：
 *  1. 字段名与控件的无障碍连线（FieldRow 生成 id，控件用 aria-labelledby 指回去）；
 *  2. 原语的可见输出（分段按钮的选项与选中态、数字格的取值与单位、段头与 meta）。
 */
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DocketSection, FieldRow, FieldTextArea, NumberField, Segmented } from '../src/components/docket/fields';

describe('FieldRow', () => {
  test('把字段名与控件用同一个 id 连起来（aria-labelledby 指向标签）', () => {
    const html = renderToStaticMarkup(
      <FieldRow label="纸张">
        <FieldTextArea value="A4" onChange={() => {}} />
      </FieldRow>,
    );
    const labelId = /id="([^"]+)"[^>]*>纸张/.exec(html)?.[1];
    expect(labelId).toBeTruthy();
    expect(html).toContain(`aria-labelledby="${labelId}"`);
  });

  test('hint 与字段名都渲染出来', () => {
    const html = renderToStaticMarkup(
      <FieldRow label="分辨率" hint="打印用 300 DPI 起步">
        <NumberField ariaLabel="分辨率" value={300} onCommit={() => {}} suffix="DPI" />
      </FieldRow>,
    );
    expect(html).toContain('分辨率');
    expect(html).toContain('打印用 300 DPI 起步');
  });
});

describe('Segmented', () => {
  test('每个选项一个按钮，当前值被选中', () => {
    const html = renderToStaticMarkup(
      <Segmented
        ariaLabel="纸张方向"
        value="landscape"
        options={[
          { value: 'portrait', label: '纵向' },
          { value: 'landscape', label: '横向' },
        ]}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('纵向');
    expect(html).toContain('横向');
    expect(html).toContain('aria-label="纸张方向"');
    expect(html).toMatch(/Mui-selected[^"]*"[^>]*>横向/);
  });
});

describe('NumberField', () => {
  test('渲染当前值与单位', () => {
    const html = renderToStaticMarkup(<NumberField ariaLabel="页边距" value={12} onCommit={() => {}} suffix="mm" />);
    expect(html).toContain('value="12"');
    expect(html).toContain('mm');
  });
});

describe('DocketSection', () => {
  test('段头渲染标题与 meta', () => {
    const html = renderToStaticMarkup(
      <DocketSection title="规格" meta="210 × 297 mm">
        <span>内容</span>
      </DocketSection>,
    );
    expect(html).toContain('规格');
    expect(html).toContain('210 × 297 mm');
    expect(html).toContain('<span>内容</span>');
  });
});