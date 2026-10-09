/**
 * 状态标记：用线的形态说话，不用颜色。
 *
 * 实线 = 已生效；点划线 = 正在出片；双线 = 已导出；虚线 = 有提醒。
 * 这套词汇来自印张上的套准线与裁切线本身。
 */
import { Box, Tooltip, Typography } from '@mui/material';
import type { ExportRecord } from '../state/types';
import { INK, MONO_FONT, FONT_PX } from '../theme';

interface StateLineProps {
  record: ExportRecord;
  /** 有提醒或错误时为 true */
  flagged: boolean;
  /** 出片、付印前的实时描述，例如当前印张的规格 */
  summary: string;
  /** flagged 时的原因；线型只说「有提醒」，原因得说出来 */
  reason?: string;
}

/** 四种线型的含义：这个世界自己知道，使用者也得看得见 */
const LINE_LEGEND = '线型即状态：实线 = 已生效 · 点划线 = 正在出片 · 双线 = 已导出 · 虚线 = 有提醒';

type LineForm = 'solid' | 'dashdot' | 'double' | 'dashed';

const DASH: Record<LineForm, string | undefined> = {
  solid: undefined,
  dashed: '5 3',
  dashdot: '7 3 1.5 3',
  double: undefined,
};

/** 线型标记：全站表达状态的唯一图形词汇 */
export function LineMark({ form, width = 34 }: { form: LineForm; width?: number }) {
  return (
    <svg width={width} height="12" viewBox={`0 0 ${width} 12`} aria-hidden="true" style={{ display: 'block', flex: '0 0 auto' }}>
      {form === 'double' ? (
        <>
          <line x1="1" y1="4.5" x2={width - 1} y2="4.5" stroke={INK} strokeWidth="1.6" />
          <line x1="1" y1="7.5" x2={width - 1} y2="7.5" stroke={INK} strokeWidth="1.6" />
        </>
      ) : (
        <line
          x1="1"
          y1="6"
          x2={width - 1}
          y2="6"
          stroke={INK}
          strokeWidth={form === 'dashdot' ? 1.6 : 1.2}
          strokeDasharray={DASH[form]}
        />
      )}
    </svg>
  );
}

export function StateLine({ record, flagged, summary, reason }: StateLineProps) {
  let form: LineForm = 'solid';
  let text = flagged && reason ? reason : summary;

  if (record.phase === 'busy') {
    form = 'dashdot';
    text = `${record.action}…`;
  } else if (record.phase === 'done') {
    form = 'double';
    text = `已导出 ${record.fileName} · ${record.pages} 页 · ${record.at}`;
  } else if (flagged) {
    form = 'dashed';
  }

  return (
    <Tooltip title={LINE_LEGEND} placement="top-start">
      <Box
        role="status"
        aria-live="polite"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.75,
          py: 0.75,
          borderTop: '1px solid var(--rule)',
          bgcolor: 'var(--paper)',
        }}
      >
        <LineMark form={form} />
        <Typography
          sx={{
            fontSize: FONT_PX.readout,
            color: record.phase === 'idle' && !flagged ? 'text.secondary' : 'text.primary',
            fontFamily: MONO_FONT,
          }}
        >
          {text}
        </Typography>
        {record.note ? (
          <Typography sx={{ fontSize: FONT_PX.readout, color: 'text.primary', whiteSpace: 'nowrap' }}>· {record.note}</Typography>
        ) : null}
        {record.error ? (
          <Typography sx={{ fontSize: FONT_PX.readout, color: 'text.primary' }}>
            {record.phase === 'done' ? `· ${record.error}` : `· 导出失败：${record.error}`}
          </Typography>
        ) : null}
        {/* 空闲时把快捷键摊在状态行右侧：桌面才显示，窄屏按优先级让位；一有导出记录就让位 */}
        {record.phase === 'idle' ? (
          <Typography
            sx={{
              ml: 'auto',
              fontSize: FONT_PX.meta,
              color: 'text.secondary',
              fontFamily: MONO_FONT,
              whiteSpace: 'nowrap',
              display: { xs: 'none', md: 'block' },
            }}
          >
            Alt+1 出片 · Alt+2 付印 · Alt+3 交版 · Alt+M 切模式
          </Typography>
        ) : null}
      </Box>
    </Tooltip>
  );
}
