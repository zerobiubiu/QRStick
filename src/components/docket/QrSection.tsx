/**
 * 二维码段：装进码里的内容、边长、纠错等级、印刷标记，以及收在「更多规格」里的静默区。
 */
import { useState } from 'react';
import { Box, Button, Checkbox, Collapse, FormControlLabel, Slider, Stack } from '@mui/material';
import type { ErrorCorrectionLevel, MarksConfig, QrConfig } from '../../lib/types';
import { DocketSection, FieldRow, FieldTextArea, NumberField, Segmented } from './fields';

export function QrSection({
  qr,
  marks,
  content,
  compact,
  onPatchQr,
  onPatchMarks,
  onContent,
}: {
  qr: QrConfig;
  marks: MarksConfig;
  content: string;
  /** 窄屏默认收起「更多二维码规格」，宽屏默认展开（低优先级参数不该占窄屏的地方） */
  compact: boolean;
  onPatchQr: (next: Partial<QrConfig>) => void;
  onPatchMarks: (next: Partial<MarksConfig>) => void;
  onContent: (content: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(!compact);

  return (
    <DocketSection title="二维码" meta={`纠错 ${qr.errorCorrectionLevel}`}>
      <FieldRow label="内容" align="start" hint="二维码里装的东西：编号、链接、备注都行，支持多行；批量模式下由数据表的「内容」列逐行覆盖">
        <FieldTextArea value={content} onChange={onContent} minRows={2} maxRows={5} mono />
      </FieldRow>
      <FieldRow label="边长" hint="含静默区的外框尺寸；读数条同时给出外框与码面，码面才是贴纸上那个黑方块的大小">
        <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center' }}>
          <NumberField
            ariaLabel="二维码边长（毫米）"
            value={qr.sizeMm}
            min={5}
            max={1000}
            suffix="mm"
            onCommit={(sizeMm) => onPatchQr({ sizeMm })}
          />
          <Slider
            size="small"
            min={10}
            max={300}
            step={1}
            value={Math.min(qr.sizeMm, 300)}
            aria-label="二维码边长滑杆"
            onChange={(_event, next) => onPatchQr({ sizeMm: next as number })}
            sx={{ flex: 1 }}
          />
        </Stack>
      </FieldRow>
      <FieldRow label="纠错等级" hint="等级越高越耐污损，但可承载的内容更少">
        <Segmented<ErrorCorrectionLevel>
          ariaLabel="二维码纠错等级"
          value={qr.errorCorrectionLevel}
          options={[
            { value: 'L', label: 'L 7%' },
            { value: 'M', label: 'M 15%' },
            { value: 'Q', label: 'Q 25%' },
            { value: 'H', label: 'H 30%' },
          ]}
          onChange={(errorCorrectionLevel) => onPatchQr({ errorCorrectionLevel })}
        />
      </FieldRow>
      <FieldRow label="印刷标记" align="start" hint="标记会印进导出文件，不是屏幕上的辅助线">
        <Stack sx={{ gap: 0 }}>
          <FormControlLabel
            control={<Checkbox checked={marks.cropMarks} onChange={(event) => onPatchMarks({ cropMarks: event.target.checked })} />}
            label="四角裁切标记"
          />
          <FormControlLabel
            control={<Checkbox checked={marks.colorBar} onChange={(event) => onPatchMarks({ colorBar: event.target.checked })} />}
            label="色标条与规格读数"
          />
          <FormControlLabel
            control={
              <Checkbox checked={marks.marginGuides} onChange={(event) => onPatchMarks({ marginGuides: event.target.checked })} />
            }
            label="页边距参考虚线"
          />
        </Stack>
      </FieldRow>
      <Box sx={{ px: 2, py: 0.75 }}>
        <Button size="small" variant="text" onClick={() => setMoreOpen((open) => !open)} sx={{ color: 'text.secondary' }}>
          {moreOpen ? '收起更多二维码规格' : '更多二维码规格（静默区）'}
        </Button>
      </Box>
      <Collapse in={moreOpen} unmountOnExit>
        <FieldRow label="静默区" hint="二维码四周的空白模块数，标准是 4">
          <NumberField
            ariaLabel="二维码静默区模块数"
            value={qr.quietZoneModules}
            min={0}
            max={16}
            suffix="模块"
            onCommit={(quietZoneModules) => onPatchQr({ quietZoneModules: Math.round(quietZoneModules) })}
          />
        </FieldRow>
      </Collapse>
    </DocketSection>
  );
}