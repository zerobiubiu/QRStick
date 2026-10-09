/**
 * MUI 主题：印刷车间的工单。
 *
 * 纪律（来自锁定方向）：
 *  - 直角：印刷东西上不出现圆角，圆角是屏幕的语法；
 *  - 发丝线承担全部层级，不用阴影堆叠、不用卡片；
 *  - 印刷三原色只作极小面积的标记与读数，界面主体永远墨黑 / 纸白；
 *  - 数字一律等宽对齐（tabular-nums）。
 */
import { createTheme } from '@mui/material/styles';

export const INK = '#101010';
/** 悬停时墨再压深一档：按钮与选中态的反白底 */
export const INK_DEEP = '#000';
export const PAPER = '#ffffff';
export const GROUND = '#f4f4f2';
export const RULE = 'rgba(16,16,16,0.16)';
export const RULE_STRONG = 'rgba(16,16,16,0.34)';
export const CYAN = '#0093d0';
export const MAGENTA = '#e5007d';
export const YELLOW = '#ffe200';

export const UI_FONT =
  "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif";
export const MONO_FONT = "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', Menlo, monospace";

/**
 * 界面字号阶梯：只走这八级（DESIGN.md 的 The One Ramp Rule）。
 * 组件一律引这里的名字而不是写裸数字——裸数字会让「八级」变成一句没人执行的约定，
 * 也让越阶的值（历史上出现过 12.5 与 14）混进来。
 */
export const FONT_PX = {
  wordmark: 15,
  body: 13,
  small: 12,
  label: 11.5,
  readout: 11,
  meta: 10.5,
  micro: 10,
  ruler: 9,
} as const;

/** 发丝线：1 物理像素的界内线 */
export const hairline = `1px solid ${RULE}`;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: INK, contrastText: PAPER },
    secondary: { main: CYAN },
    background: { default: GROUND, paper: PAPER },
    divider: RULE,
    text: {
      primary: INK,
      secondary: 'rgba(16,16,16,0.62)',
      disabled: 'rgba(16,16,16,0.45)',
    },
    // 状态一律由线型（实线/虚线/点划线/双线）承担，颜色回到墨黑；
    // 这里只为满足 MUI 调色板形状保留 error，不再有离palette的红/黄/绿
    error: { main: INK },
  },
  shape: { borderRadius: 0 },
  typography: {
    fontFamily: UI_FONT,
    fontSize: 13,
    htmlFontSize: 16,
    h3: { fontSize: '0.9375rem', fontWeight: 700, letterSpacing: 0 },
    body1: { fontSize: '0.8125rem' },
    body2: { fontSize: '0.75rem' },
    caption: { fontSize: '0.6875rem', letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0, fontSize: '0.8125rem' },
  },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0, square: true },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true, disableRipple: false },
      styleOverrides: {
        root: {
          borderRadius: 0,
          minHeight: 32,
          paddingInline: 14,
          border: `1px solid ${RULE_STRONG}`,
          color: INK,
          '&:hover': { borderColor: INK, background: 'var(--tint-hover)' },
        },
        contained: {
          borderColor: INK,
          color: PAPER,
          '&:hover': { background: INK_DEEP, borderColor: INK_DEEP },
        },
        outlined: { color: INK },
        text: { border: '1px solid transparent', paddingInline: 8 },
        sizeSmall: { minHeight: 26, fontSize: '0.75rem', paddingInline: 10 },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: { borderRadius: 0, gap: 0 },
        grouped: {
          borderRadius: '0 !important',
          marginLeft: '-1px !important',
          borderColor: RULE_STRONG,
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          textTransform: 'none',
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'rgba(16,16,16,0.62)',
          paddingBlock: 5,
          paddingInline: 10,
          '&.Mui-selected': {
            background: INK,
            color: PAPER,
            '&:hover': { background: INK_DEEP },
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          fontSize: '0.8125rem',
          backgroundColor: PAPER,
          '& fieldset': { borderColor: RULE_STRONG },
          '&:hover fieldset': { borderColor: INK },
          '&.Mui-focused fieldset': { borderColor: INK, borderWidth: '1px' },
        },
        input: { padding: '6px 9px', height: 'auto' },
      },
    },
    MuiSelect: { styleOverrides: { select: { paddingBlock: 6, paddingInline: 9 } } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.75rem' } } },
    MuiMenu: { styleOverrides: { paper: { border: `1px solid ${RULE_STRONG}`, borderRadius: 0, marginTop: 2 } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: '0.8125rem', minHeight: 32 } } },
    MuiSlider: {
      styleOverrides: {
        root: { color: INK, paddingBlock: 10 },
        rail: { backgroundColor: RULE_STRONG, opacity: 1 },
        track: { border: 'none', backgroundColor: INK },
        thumb: {
          borderRadius: 0,
          width: 10,
          height: 16,
          marginTop: -5,
          marginLeft: -5,
          '&:hover, &.Mui-focusVisible': { boxShadow: 'none' },
        },
      },
    },
    MuiCheckbox: {
      defaultProps: { size: 'small' },
      styleOverrides: { root: { borderRadius: 0, padding: 5, color: RULE_STRONG, '&.Mui-checked': { color: INK } } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 0,
          backgroundColor: INK,
          fontSize: '0.6875rem',
          padding: '5px 7px',
          maxWidth: 260,
        },
        arrow: { color: INK },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: '0.75rem' }, root: { marginLeft: -6 } },
    },
  },
});
