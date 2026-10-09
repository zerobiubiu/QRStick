/**
 * 联单的字段原语：工单里每一个参数都是「字段名 : 值」的一格。
 *
 * 这里是全站唯一的参数输入形态（FieldRow）与三种控件格（文本域 / 下拉 / 数字）
 * 加一个成组切换按钮；它们只关心「怎么呈现一格」，不关心具体参数是什么，
 * 所以任何新的规格段都直接复用，不要另写一套输入框。
 */
import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { Box, MenuItem, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { clamp } from '../../lib/units';
import { MONO_FONT, FONT_PX } from '../../theme';

/** 字段名到控件的无障碍连线：FieldRow 生成 id，控件用 aria-labelledby 指回来 */
const FieldLabelId = createContext<string | undefined>(undefined);

export function FieldRow({
  label,
  children,
  hint,
  align = 'center',
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  align?: 'center' | 'start';
}) {
  const labelId = useId();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '96px minmax(0, 1fr)',
        columnGap: 1.5,
        rowGap: 0.5,
        alignItems: align === 'start' ? 'start' : 'center',
        px: 2,
        py: 1,
        borderBottom: '1px solid var(--rule)',
      }}
    >
      <Typography
        id={labelId}
        component="span"
        sx={{ fontSize: FONT_PX.label, color: 'text.secondary', pt: align === 'start' ? 0.75 : 0 }}
      >
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <FieldLabelId.Provider value={labelId}>{children}</FieldLabelId.Provider>
      </Box>
      {hint ? (
        <Typography component="span" sx={{ gridColumn: '2', fontSize: FONT_PX.meta, color: 'text.secondary', lineHeight: 1.35 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

/** 多行文本格：字段名走 aria-labelledby，屏幕阅读器念得出这是哪一栏 */
export function FieldTextArea({
  value,
  onChange,
  mono = false,
  minRows = 2,
  maxRows = 5,
}: {
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
  minRows?: number;
  maxRows?: number;
}) {
  const labelId = useContext(FieldLabelId);
  return (
    <TextField
      size="small"
      fullWidth
      multiline
      minRows={minRows}
      maxRows={maxRows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        htmlInput: {
          'aria-labelledby': labelId,
          style: { lineHeight: 1.5, fontFamily: mono ? MONO_FONT : 'inherit' },
        },
      }}
    />
  );
}

/** 下拉格：同一条无障碍连线 */
export function FieldSelect({
  value,
  options,
  onChange,
  renderValue,
}: {
  value: string;
  options: { value: string; label: string; fontFamily?: string }[];
  onChange: (value: string) => void;
  renderValue?: (value: string) => ReactNode;
}) {
  const labelId = useContext(FieldLabelId);
  return (
    <Select
      size="small"
      fullWidth
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputProps={{ 'aria-labelledby': labelId }}
      renderValue={renderValue}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value} sx={option.fontFamily ? { fontFamily: option.fontFamily } : undefined}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}

export function DocketSection({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section" aria-label={title}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          py: 0.75,
          bgcolor: 'var(--tint-band)',
          borderBottom: '1px solid var(--rule)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <Typography component="h2" sx={{ fontSize: FONT_PX.label, fontWeight: 700, margin: 0 }}>{title}</Typography>
        {meta ? (
          <Typography sx={{ fontSize: FONT_PX.meta, color: 'text.secondary', fontFamily: MONO_FONT }}>{meta}</Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

export function NumberField({
  value,
  onCommit,
  ariaLabel,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
}: {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const labelId = useContext(FieldLabelId);
  // 宽度只有两档规则：带单位 / 不带单位，不再按字段即兴取值
  const width = suffix ? 96 : 76;
  return (
    <Stack sx={{ gap: 0.25 }}>
      <TextField
        size="small"
        type="number"
        value={draft ?? String(value)}
        aria-label={ariaLabel}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          if (text.trim() === '') {
            setNotice('');
            return;
          }
          const parsed = Number(text);
          if (!Number.isFinite(parsed)) return;
          if (parsed < min || parsed > max) {
            const limit = parsed > max ? max : min;
            setNotice(`已收到 ${parsed}，按${parsed > max ? '上' : '下'}限 ${limit} 生效`);
          } else {
            setNotice('');
          }
          onCommit(clamp(parsed, min, max, 2));
        }}
        onBlur={() => {
          setDraft(null);
          setNotice('');
        }}
        slotProps={{
          htmlInput: { min, max, step, 'aria-labelledby': labelId },
          input: {
            style: { fontFamily: MONO_FONT, paddingBlock: 6 },
            endAdornment: suffix ? (
              <Typography component="span" sx={{ fontSize: FONT_PX.meta, color: 'text.secondary', ml: 0.5, whiteSpace: 'nowrap' }}>
                {suffix}
              </Typography>
            ) : undefined,
          },
        }}
        sx={{ width }}
      />
      {notice ? (
        <Typography sx={{ fontSize: FONT_PX.micro, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {notice}
        </Typography>
      ) : null}
    </Stack>
  );
}

/** 字段名右侧的成组切换按钮 */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      aria-label={ariaLabel}
      onChange={(_event, next: T | null) => {
        if (next !== null) onChange(next);
      }}
    >
      {options.map((option) => (
        <ToggleButton key={String(option.value)} value={option.value}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}