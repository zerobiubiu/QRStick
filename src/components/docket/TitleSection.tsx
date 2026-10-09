/**
 * 标题段：标题内容、字体、字号、对齐与在码上/码下、粗细与行距、与码间距。
 */
import { Slider, Stack } from '@mui/material';
import { LABEL_FONTS } from '../../lib/fonts';
import type { Align, TitleConfig, TitlePosition } from '../../lib/types';
import { DocketSection, FieldRow, FieldSelect, FieldTextArea, NumberField, Segmented } from './fields';

export function TitleSection({
  title,
  onPatch,
}: {
  title: TitleConfig;
  onPatch: (next: Partial<TitleConfig>) => void;
}) {
  return (
    <DocketSection title="标题" meta={`${title.text.split('\n').length} 行输入`}>
      <FieldRow label="标题内容" align="start" hint="批量模式下同样由 CSV 的「标题」列逐行覆盖">
        <FieldTextArea value={title.text} onChange={(text) => onPatch({ text })} minRows={2} maxRows={4} />
      </FieldRow>
      <FieldRow label="字体">
        <FieldSelect
          value={title.fontId}
          options={LABEL_FONTS.map((font) => ({ value: font.id, label: font.label, fontFamily: font.stack }))}
          onChange={(fontId) => onPatch({ fontId })}
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
            value={title.fontSizePt}
            min={4}
            max={400}
            step={0.5}
            suffix="pt"
            onCommit={(fontSizePt) => onPatch({ fontSizePt })}
          />
          <Slider
            size="small"
            min={6}
            max={160}
            step={1}
            value={Math.min(title.fontSizePt, 160)}
            aria-label="标题字号滑杆"
            onChange={(_event, next) => onPatch({ fontSizePt: next as number })}
            sx={{ flex: 1 }}
          />
        </Stack>
      </FieldRow>
      <FieldRow label="对齐 / 位置">
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Segmented<Align>
            ariaLabel="标题对齐"
            value={title.align}
            options={[
              { value: 'left', label: '左' },
              { value: 'center', label: '中' },
              { value: 'right', label: '右' },
            ]}
            onChange={(align) => onPatch({ align })}
          />
          <Segmented<TitlePosition>
            ariaLabel="标题位置"
            value={title.position}
            options={[
              { value: 'above', label: '码上方' },
              { value: 'below', label: '码下方' },
            ]}
            onChange={(position) => onPatch({ position })}
          />
        </Stack>
      </FieldRow>
      <FieldRow label="加粗 / 行距">
        <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
          <Segmented<'bold' | 'regular'>
            ariaLabel="标题粗细"
            value={title.bold ? 'bold' : 'regular'}
            options={[
              { value: 'regular', label: '常规' },
              { value: 'bold', label: '加粗' },
            ]}
            onChange={(next) => onPatch({ bold: next === 'bold' })}
          />
          <NumberField
            ariaLabel="标题行距倍数"
            value={title.lineHeight}
            min={0.9}
            max={2.5}
            step={0.05}
            suffix="倍"
            onCommit={(lineHeight) => onPatch({ lineHeight })}
          />
        </Stack>
      </FieldRow>
      <FieldRow label="与码间距">
        <NumberField
          ariaLabel="标题与二维码间距（毫米）"
          value={title.gapMm}
          min={0}
          max={80}
          suffix="mm"
          onCommit={(gapMm) => onPatch({ gapMm })}
        />
      </FieldRow>
    </DocketSection>
  );
}