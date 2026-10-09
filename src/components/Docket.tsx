/**
 * 工单：参数的唯一入口。
 *
 * 每个参数都是「字段名 : 值」的一格（联单的语法），字段按优先级分为
 * 规格 / 标题 / 二维码 / 输出四段；低优先级的参数收在「更多规格」里，
 * 窄屏时默认收起，印张永远不被参数挤掉。
 */
import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { LABEL_FONTS } from '../lib/fonts';
import { DPI_PRESETS, PAGE_PRESETS, clamp, formatMm, parseAspectRatio } from '../lib/units';
import type { Align, ErrorCorrectionLevel, TitlePosition } from '../lib/types';
import type { LabelIssue } from '../lib/render';
import type { LabelStore } from '../state/labelStore';
import { BatchSource } from './BatchSource';
import { LineMark } from './StateLine';
import { INK, MONO_FONT, PAPER, RULE_STRONG, UI_FONT } from '../theme';

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
        sx={{ fontSize: 11.5, color: 'text.secondary', pt: align === 'start' ? 0.75 : 0 }}
      >
        {label}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <FieldLabelId.Provider value={labelId}>{children}</FieldLabelId.Provider>
      </Box>
      {hint ? (
        <Typography component="span" sx={{ gridColumn: '2', fontSize: 10.5, color: 'text.secondary', lineHeight: 1.35 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

/** 多行文本格：字段名走 aria-labelledby，屏幕阅读器念得出这是哪一栏 */
function FieldTextArea({
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
function FieldSelect({
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
    <Box component="section">
      <Stack
        direction="row"
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 1,
          px: 2,
          py: 0.75,
          bgcolor: 'rgba(16,16,16,0.035)',
          borderBottom: '1px solid var(--rule)',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{title}</Typography>
        {meta ? (
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontFamily: MONO_FONT }}>{meta}</Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

function NumberField({
  value,
  onCommit,
  ariaLabel,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
  width = 82,
}: {
  value: number;
  onCommit: (value: number) => void;
  ariaLabel: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const labelId = useContext(FieldLabelId);
  return (
    <TextField
      size="small"
      type="number"
      value={draft ?? String(value)}
      aria-label={ariaLabel}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        if (text.trim() === '') return;
        const parsed = Number(text);
        if (Number.isFinite(parsed)) onCommit(clamp(parsed, min, max, 2));
      }}
      onBlur={() => setDraft(null)}
      slotProps={{
        htmlInput: { min, max, step, 'aria-labelledby': labelId },
        input: {
          style: { fontFamily: MONO_FONT, paddingBlock: 6 },
          endAdornment: suffix ? (
            <Typography component="span" sx={{ fontSize: 10.5, color: 'text.secondary', ml: 0.5 }}>
              {suffix}
            </Typography>
          ) : undefined,
        },
      }}
      sx={{ width }}
    />
  );
}

/** 字段名右侧的成组切换按钮 */
function Segmented<T extends string | number>({
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

export function Docket({ store, compact, issues }: { store: LabelStore; compact: boolean; issues: LabelIssue[] }) {
  const { config, patchPage, patchQr, patchTitle, patchMarks } = store;
  const [ratioText, setRatioText] = useState('1:1.414');
  const [moreOpen, setMoreOpen] = useState(!compact);
  const custom = config.page.presetId === 'custom';

  const applyRatio = () => {
    const ratio = parseAspectRatio(ratioText);
    if (ratio === null) return;
    patchPage({ presetId: 'custom', heightMm: Math.round(config.page.widthMm * ratio * 10) / 10 });
  };

  return (
    <Box
      component="aside"
      sx={{
        bgcolor: PAPER,
        borderRight: { md: '1px solid var(--rule)' },
        borderBottom: { xs: '1px solid var(--rule)', md: 'none' },
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ overflowY: 'auto', minHeight: 0, flex: 1 }}>
        <DocketSection title="规格" meta={`${formatMm(config.page.widthMm)} × ${formatMm(config.page.heightMm)}`}>
          <FieldRow label="纸张">
            <FieldSelect
              value={config.page.presetId}
              options={PAGE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
              onChange={(presetId) => {
                const preset = PAGE_PRESETS.find((p) => p.id === presetId);
                if (!preset) return;
                patchPage({ presetId: preset.id, widthMm: preset.widthMm, heightMm: preset.heightMm });
              }}
            />
          </FieldRow>
          <FieldRow label="方向">
            <Segmented
              ariaLabel="纸张方向"
              value={config.page.landscape ? 'landscape' : 'portrait'}
              options={[
                { value: 'portrait', label: '纵向' },
                { value: 'landscape', label: '横向' },
              ]}
              onChange={(next) => patchPage({ landscape: next === 'landscape' })}
            />
          </FieldRow>
          {custom ? (
            <>
              <FieldRow label="宽度">
                <NumberField
                  ariaLabel="纸张宽度（毫米）"
                  value={config.page.widthMm}
                  min={10}
                  max={2000}
                  suffix="mm"
                  onCommit={(widthMm) => patchPage({ widthMm })}
                />
              </FieldRow>
              <FieldRow label="高度">
                <NumberField
                  ariaLabel="纸张高度（毫米）"
                  value={config.page.heightMm}
                  min={10}
                  max={2000}
                  suffix="mm"
                  onCommit={(heightMm) => patchPage({ heightMm })}
                />
              </FieldRow>
              <FieldRow label="长宽比" hint="宽:高，回车套用（例 1:1.414、3:4、0.707）">
                <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
                  <TextField
                    size="small"
                    value={ratioText}
                    onChange={(event) => setRatioText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') applyRatio();
                    }}
                    slotProps={{ htmlInput: { 'aria-label': '长宽比' } }}
                    sx={{ width: 96, '& input': { fontFamily: MONO_FONT } }}
                  />
                  <Button size="small" variant="outlined" onClick={applyRatio}>
                    套用
                  </Button>
                </Stack>
              </FieldRow>
            </>
          ) : null}
          <FieldRow label="分辨率" hint="决定导出像素密度；打印用 300 DPI 起步">
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <NumberField
                ariaLabel="分辨率（DPI）"
                value={config.page.dpi}
                min={36}
                max={1200}
                step={6}
                suffix="DPI"
                width={92}
                onCommit={(dpi) => patchPage({ dpi: Math.round(dpi) })}
              />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={DPI_PRESETS.includes(config.page.dpi) ? config.page.dpi : null}
                onChange={(_event, next: number | null) => {
                  if (next !== null) patchPage({ dpi: next });
                }}
              >
                {[150, 300, 600].map((dpi) => (
                  <ToggleButton key={dpi} value={dpi}>
                    {dpi}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          </FieldRow>
          <FieldRow label="页边距" hint="四边留白；裁切标记与色标条画在这块留白里">
            <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
              <NumberField
                ariaLabel="页边距（毫米）"
                value={config.page.marginMm}
                min={0}
                max={80}
                suffix="mm"
                width={82}
                onCommit={(marginMm) => patchPage({ marginMm })}
              />
              <Slider
                size="small"
                min={0}
                max={60}
                step={0.5}
                value={Math.min(config.page.marginMm, 60)}
                aria-label="页边距滑杆"
                onChange={(_event, next) => patchPage({ marginMm: next as number })}
                sx={{ flex: 1 }}
              />
            </Stack>
          </FieldRow>
        </DocketSection>

        <DocketSection title="标题" meta={`${config.title.text.split('\n').length} 行输入`}>
          <FieldRow label="标题内容" align="start">
            <FieldTextArea value={config.title.text} onChange={(text) => patchTitle({ text })} minRows={2} maxRows={4} />
          </FieldRow>
          <FieldRow label="字体">
            <FieldSelect
              value={config.title.fontId}
              options={LABEL_FONTS.map((font) => ({ value: font.id, label: font.label, fontFamily: font.stack }))}
              onChange={(fontId) => patchTitle({ fontId })}
              renderValue={(id) => {
                const font = LABEL_FONTS.find((item) => item.id === id) ?? LABEL_FONTS[0];
                return <span style={{ fontFamily: font.stack }}>{font.label}</span>;
              }}
            />
          </FieldRow>
          <FieldRow label="字号">
            <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
              <NumberField
                ariaLabel="标题字号（磅）"
                value={config.title.fontSizePt}
                min={4}
                max={400}
                step={0.5}
                suffix="pt"
                width={84}
                onCommit={(fontSizePt) => patchTitle({ fontSizePt })}
              />
              <Slider
                size="small"
                min={6}
                max={160}
                step={1}
                value={Math.min(config.title.fontSizePt, 160)}
                aria-label="标题字号滑杆"
                onChange={(_event, next) => patchTitle({ fontSizePt: next as number })}
                sx={{ flex: 1 }}
              />
            </Stack>
          </FieldRow>
          <FieldRow label="对齐 / 位置">
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Segmented<Align>
                ariaLabel="标题对齐"
                value={config.title.align}
                options={[
                  { value: 'left', label: '左' },
                  { value: 'center', label: '中' },
                  { value: 'right', label: '右' },
                ]}
                onChange={(align) => patchTitle({ align })}
              />
              <Segmented<TitlePosition>
                ariaLabel="标题位置"
                value={config.title.position}
                options={[
                  { value: 'above', label: '码上方' },
                  { value: 'below', label: '码下方' },
                ]}
                onChange={(position) => patchTitle({ position })}
              />
            </Stack>
          </FieldRow>
          <FieldRow label="加粗 / 行距">
            <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
              <Segmented<'bold' | 'regular'>
                ariaLabel="标题粗细"
                value={config.title.bold ? 'bold' : 'regular'}
                options={[
                  { value: 'regular', label: '常规' },
                  { value: 'bold', label: '加粗' },
                ]}
                onChange={(next) => patchTitle({ bold: next === 'bold' })}
              />
              <NumberField
                ariaLabel="标题行距倍数"
                value={config.title.lineHeight}
                min={0.9}
                max={2.5}
                step={0.05}
                suffix="倍"
                width={84}
                onCommit={(lineHeight) => patchTitle({ lineHeight })}
              />
            </Stack>
          </FieldRow>
          <FieldRow label="与码间距">
            <NumberField
              ariaLabel="标题与二维码间距（毫米）"
              value={config.title.gapMm}
              min={0}
              max={80}
              suffix="mm"
              onCommit={(gapMm) => patchTitle({ gapMm })}
            />
          </FieldRow>
        </DocketSection>

        <DocketSection title="二维码" meta={`纠错 ${config.qr.errorCorrectionLevel}`}>
          <FieldRow label="内容" align="start" hint="二维码里装的东西：编号、链接、备注都行，支持多行；批量模式下由 CSV 逐行覆盖">
            <FieldTextArea value={config.content} onChange={store.setContent} minRows={2} maxRows={5} mono />
          </FieldRow>
          <FieldRow label="边长" hint="含静默区；按整数像素 / 模块落地，实际边长以读数为准">
            <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
              <NumberField
                ariaLabel="二维码边长（毫米）"
                value={config.qr.sizeMm}
                min={5}
                max={1000}
                suffix="mm"
                onCommit={(sizeMm) => patchQr({ sizeMm })}
              />
              <Slider
                size="small"
                min={10}
                max={300}
                step={1}
                value={Math.min(config.qr.sizeMm, 300)}
                aria-label="二维码边长滑杆"
                onChange={(_event, next) => patchQr({ sizeMm: next as number })}
                sx={{ flex: 1 }}
              />
            </Stack>
          </FieldRow>
          <FieldRow label="纠错等级" hint="等级越高越耐污损，但可承载的内容更少">
            <Segmented<ErrorCorrectionLevel>
              ariaLabel="二维码纠错等级"
              value={config.qr.errorCorrectionLevel}
              options={[
                { value: 'L', label: 'L 7%' },
                { value: 'M', label: 'M 15%' },
                { value: 'Q', label: 'Q 25%' },
                { value: 'H', label: 'H 30%' },
              ]}
              onChange={(errorCorrectionLevel) => patchQr({ errorCorrectionLevel })}
            />
          </FieldRow>
          <FieldRow label="印刷标记" align="start" hint="标记会印进导出文件，不是屏幕上的辅助线">
            <Stack sx={{ gap: 0 }}>
              <FormControlLabel
                control={
                  <Checkbox checked={config.marks.cropMarks} onChange={(event) => patchMarks({ cropMarks: event.target.checked })} />
                }
                label="四角裁切标记"
              />
              <FormControlLabel
                control={
                  <Checkbox checked={config.marks.colorBar} onChange={(event) => patchMarks({ colorBar: event.target.checked })} />
                }
                label="色标条与规格读数"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.marks.marginGuides}
                    onChange={(event) => patchMarks({ marginGuides: event.target.checked })}
                  />
                }
                label="页边距参考虚线"
              />
            </Stack>
          </FieldRow>
          <Box sx={{ px: 2, py: 0.75 }}>
            <Button size="small" variant="text" onClick={() => setMoreOpen((open) => !open)} sx={{ color: 'text.secondary' }}>
              {moreOpen ? '收起更多规格' : '更多规格（静默区）'}
            </Button>
          </Box>
          <Collapse in={moreOpen} unmountOnExit>
            <FieldRow label="静默区" hint="二维码四周的空白模块数，标准是 4">
              <NumberField
                ariaLabel="二维码静默区模块数"
                value={config.qr.quietZoneModules}
                min={0}
                max={16}
                suffix="模块"
                width={92}
                onCommit={(quietZoneModules) => patchQr({ quietZoneModules: Math.round(quietZoneModules) })}
              />
            </FieldRow>
          </Collapse>
        </DocketSection>

        {store.mode === 'batch' ? <BatchSource store={store} /> : null}

        {issues.length ? (
          <DocketSection
            title="体检"
            meta={`${issues.filter((item) => item.level === 'error').length} 错 · ${issues.filter((item) => item.level === 'warn').length} 警`}
          >
            {issues.map((issue, index) => (
              <Stack key={`${index}-${issue.message}`} direction="row" sx={{ gap: 1, alignItems: 'flex-start', px: 2, py: 0.6 }}>
                <Box sx={{ pt: 0.25 }}>
                  <LineMark form={issue.level === 'error' ? 'double' : 'dashed'} width={22} />
                </Box>
                <Typography
                  sx={{ fontSize: 11.5, lineHeight: 1.5, color: 'text.primary' }}
                >
                  {issue.message}
                </Typography>
              </Stack>
            ))}
          </DocketSection>
        ) : null}
      </Box>

      <Box
        sx={{
          mt: 'auto',
          px: 2,
          py: 1.25,
          borderTop: `1.5px solid ${INK}`,
          bgcolor: 'rgba(16,16,16,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontFamily: UI_FONT, borderColor: RULE_STRONG }}>
          参数改动即时重排印张，没有「应用」这一步。
        </Typography>
        <Tooltip title="恢复到出厂的默认参数；批量数据不会被删除">
          <Button size="small" variant="outlined" onClick={store.reset}>
            恢复默认
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
}
