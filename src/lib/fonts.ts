/**
 * 标签标题可用字体。
 *
 * 每个字体给两套名字：`stack` 给浏览器（画布与界面预览用），
 * `docxName` 给 Word（Word 只认单个字体名，不认 CSS 回退链）。
 * 全部用系统已安装字体，纯前端站不加载网络字体，离线也能出正确的图。
 */
export interface LabelFont {
  id: string;
  label: string;
  stack: string;
  docxName: string;
}

export const LABEL_FONTS: LabelFont[] = [
  {
    id: 'hei',
    label: '黑体（无衬线）',
    stack: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif',
    docxName: 'Microsoft YaHei',
  },
  {
    id: 'song',
    label: '宋体（衬线）',
    stack: '"SimSun", "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif',
    docxName: 'SimSun',
  },
  {
    id: 'kai',
    label: '楷体',
    stack: '"KaiTi", "STKaiti", "Kaiti SC", serif',
    docxName: 'KaiTi',
  },
  {
    id: 'mono',
    label: '等宽（编号）',
    stack: '"Cascadia Mono", Consolas, "DejaVu Sans Mono", Menlo, monospace',
    docxName: 'Consolas',
  },
];

export function resolveLabelFont(id: string): LabelFont {
  return LABEL_FONTS.find((f) => f.id === id) ?? LABEL_FONTS[0];
}
