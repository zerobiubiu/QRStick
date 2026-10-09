/**
 * 状态标记：用线的形态说话，不用颜色。
 *
 * 实线 = 已生效；点划线 = 正在出片；双线 = 已导出；虚线 = 有提醒。
 * 这套词汇来自印张上的套准线与裁切线本身。
 */
import { Box, Typography } from '@mui/material';
import type { ExportRecord } from '../state/labelStore';
import { INK, MONO_FONT } from '../theme';

interface StateLineProps {
  record: ExportRecord;
  /** 有提醒或错误时为 true */
  flagged: boolean;
  /** 出片、付印前的实时描述，例如当前印张的规格 */
  summary: string;
}

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

export function StateLine({ record, flagged, summary }: StateLineProps) {
  let form: LineForm = 'solid';
  let text = summary;

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
    <Box
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
        sx={{ fontSize: 11, color: record.phase === 'idle' && !flagged ? 'text.secondary' : 'text.primary', fontFamily: MONO_FONT }}
      >
        {text}
      </Typography>
      {record.error ? (
        <Typography sx={{ fontSize: 11, color: 'error.main' }}>· {record.error}</Typography>
      ) : null}
    </Box>
  );
}
