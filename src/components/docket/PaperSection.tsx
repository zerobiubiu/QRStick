/**
 * 规格段：纸张、方向、版式站位、自定义毫米尺寸与长宽比、分辨率、页边距。
 *
 * 只认页面配置与它的 patch 回调，不碰其余状态——改纸张不会牵动标题或二维码。
 */
import { useState } from 'react';
import { Button, Slider, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { DPI_PRESETS, PAGE_PRESETS, formatMm, parseAspectRatio } from '../../lib/units';
import type { BlockAlign, PageConfig } from '../../lib/types';
import { MONO_FONT } from '../../theme';
import { DocketSection, FieldRow, FieldSelect, NumberField, Segmented } from './fields';

export function PaperSection({
  page,
  onPatch,
}: {
  page: PageConfig;
  onPatch: (next: Partial<PageConfig>) => void;
}) {
  const [ratioText, setRatioText] = useState('1:1.414');
  const [ratioError, setRatioError] = useState('');
  const custom = page.presetId === 'custom';

  const applyRatio = () => {
    const ratio = parseAspectRatio(ratioText);
    if (ratio === null) {
      // 静默丢弃会被当成「这功能坏了」：就地说明它看不懂什么
      setRatioError('看不懂这种写法。请用 宽:高（1:1.414）、3:4，或一个小数（0.707）');
      return;
    }
    setRatioError('');
    onPatch({ presetId: 'custom', heightMm: Math.round(page.widthMm * ratio * 10) / 10 });
  };

  return (
    <DocketSection title="规格" meta={`${formatMm(page.widthMm)} × ${formatMm(page.heightMm)}`}>
      <FieldRow label="纸张">
        <FieldSelect
          value={page.presetId}
          options={PAGE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
          onChange={(presetId) => {
            const preset = PAGE_PRESETS.find((p) => p.id === presetId);
            if (!preset) return;
            onPatch({ presetId: preset.id, widthMm: preset.widthMm, heightMm: preset.heightMm, landscape: false });
          }}
        />
      </FieldRow>
      <FieldRow label="方向">
        <Segmented
          ariaLabel="纸张方向"
          value={page.landscape ? 'landscape' : 'portrait'}
          options={[
            { value: 'portrait', label: '纵向' },
            { value: 'landscape', label: '横向' },
          ]}
          onChange={(next) => onPatch({ landscape: next === 'landscape' })}
        />
      </FieldRow>
      <FieldRow label="版式站位" hint="内容块（标题 + 二维码）在版心里的垂直位置；居中时上下留白各一半">
        <Segmented<BlockAlign>
          ariaLabel="版式垂直站位"
          value={page.blockAlign}
          options={[
            { value: 'top', label: '顶部' },
            { value: 'center', label: '居中' },
            { value: 'bottom', label: '底部' },
          ]}
          onChange={(blockAlign) => onPatch({ blockAlign })}
        />
      </FieldRow>
      {custom ? (
        <>
          <FieldRow label="宽度">
            <NumberField
              ariaLabel="纸张宽度（毫米）"
              value={page.widthMm}
              min={10}
              max={2000}
              suffix="mm"
              onCommit={(widthMm) => onPatch({ widthMm })}
            />
          </FieldRow>
          <FieldRow label="高度">
            <NumberField
              ariaLabel="纸张高度（毫米）"
              value={page.heightMm}
              min={10}
              max={2000}
              suffix="mm"
              onCommit={(heightMm) => onPatch({ heightMm })}
            />
          </FieldRow>
          <FieldRow label="长宽比" hint={ratioError || '宽:高，回车套用（例 1:1.414、3:4、0.707）'}>
            <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center' }}>
              <TextField
                size="small"
                value={ratioText}
                onChange={(event) => {
                  setRatioText(event.target.value);
                  if (ratioError) setRatioError('');
                }}
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
            value={page.dpi}
            min={36}
            max={1200}
            step={6}
            suffix="DPI"
            onCommit={(dpi) => onPatch({ dpi: Math.round(dpi) })}
          />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={DPI_PRESETS.includes(page.dpi) ? page.dpi : null}
            onChange={(_event, next: number | null) => {
              if (next !== null) onPatch({ dpi: next });
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
            value={page.marginMm}
            min={0}
            max={80}
            suffix="mm"
            onCommit={(marginMm) => onPatch({ marginMm })}
          />
          <Slider
            size="small"
            min={0}
            max={60}
            step={0.5}
            value={Math.min(page.marginMm, 60)}
            aria-label="页边距滑杆"
            onChange={(_event, next) => onPatch({ marginMm: next as number })}
            sx={{ flex: 1 }}
          />
        </Stack>
      </FieldRow>
    </DocketSection>
  );
}