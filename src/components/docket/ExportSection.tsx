/**
 * 导出段：图片格式与质量、批量图片的三种模式（逐张 / ZIP / 拼接）及其排布参数。
 */
import { Box, Checkbox, FormControlLabel, Slider, Stack, Typography } from '@mui/material';
import type { ImageExportMode, ImageExportOptions, ImageFormat, StitchPlacement } from '../../lib/types';
import type { AppMode } from '../../state/types';
import { MONO_FONT } from '../../theme';
import { DocketSection, FieldRow, NumberField, Segmented } from './fields';

export function ExportSection({
  imageExport,
  mode,
  onPatch,
}: {
  imageExport: ImageExportOptions;
  mode: AppMode;
  onPatch: (next: Partial<Omit<ImageExportOptions, 'stitch'>> & { stitch?: Partial<ImageExportOptions['stitch']> }) => void;
}) {
  return (
    <DocketSection
      title="导出"
      meta={`${imageExport.format.toUpperCase()} · ${imageExport.mode === 'each' ? '逐张' : imageExport.mode === 'zip' ? '打包' : '拼接'}`}
    >
      <FieldRow label="图片格式" hint="PNG 无损、体积大；JPEG 有损、可调质量">
        <Segmented<ImageFormat>
          ariaLabel="图片导出格式"
          value={imageExport.format}
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'jpeg', label: 'JPEG' },
          ]}
          onChange={(format) => onPatch({ format })}
        />
      </FieldRow>
      {imageExport.format === 'jpeg' ? (
        <>
          <FieldRow label="JPEG 质量" hint={`当前 ${Math.round(imageExport.quality * 100)}%`}>
            <Slider
              size="small"
              min={0.5}
              max={1}
              step={0.01}
              value={imageExport.quality}
              aria-label="JPEG 质量"
              onChange={(_event, next) => onPatch({ quality: next as number })}
            />
          </FieldRow>
          <FieldRow label="背景色" hint="JPEG 没有透明通道：标签本身是纸白，这个颜色只在图片有透明区域（拼接留白）时可见">
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
              <Box
                component="input"
                type="color"
                aria-label="导出背景色"
                value={imageExport.background}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPatch({ background: event.target.value })}
                sx={{ width: 44, height: 26, p: 0, border: '1px solid var(--rule-strong)', bgcolor: 'transparent' }}
              />
              <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary' }}>
                {imageExport.background}
              </Typography>
            </Stack>
          </FieldRow>
        </>
      ) : null}
      {mode === 'batch' ? (
        <>
          <FieldRow label="批量模式" hint="逐张会被浏览器拦多次下载；打包是一个动作一个文件；拼接把多张拼成一张">
            <Segmented<ImageExportMode>
              ariaLabel="批量图片导出模式"
              value={imageExport.mode}
              options={[
                { value: 'each', label: '逐张' },
                { value: 'zip', label: '打包 ZIP' },
                { value: 'stitch', label: '拼接一张' },
              ]}
              onChange={(next) => onPatch({ mode: next })}
            />
          </FieldRow>
          {imageExport.mode === 'stitch' ? (
            <>
              <FieldRow label="拼接排布">
                <Segmented<StitchPlacement>
                  ariaLabel="拼接排布"
                  value={imageExport.stitch.placement}
                  options={[
                    { value: 'grid', label: '网格' },
                    { value: 'vertical', label: '纵向' },
                    { value: 'horizontal', label: '横向' },
                  ]}
                  onChange={(placement) => onPatch({ stitch: { placement } })}
                />
              </FieldRow>
              {imageExport.stitch.placement === 'grid' ? (
                <FieldRow label="列数">
                  <NumberField
                    ariaLabel="拼接列数"
                    value={imageExport.stitch.columns}
                    min={1}
                    max={8}
                    suffix="列"
                    onCommit={(columns) => onPatch({ stitch: { columns: Math.round(columns) } })}
                  />
                </FieldRow>
              ) : null}
              <FieldRow label="间距">
                <NumberField
                  ariaLabel="拼接间距（毫米）"
                  value={imageExport.stitch.gapMm}
                  min={0}
                  max={40}
                  step={0.5}
                  suffix="mm"
                  onCommit={(gapMm) => onPatch({ stitch: { gapMm } })}
                />
              </FieldRow>
              <FieldRow label="每张加标题">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={imageExport.stitch.captions}
                      onChange={(event) => onPatch({ stitch: { captions: event.target.checked } })}
                    />
                  }
                  label="在每张图下面印一行标题"
                />
              </FieldRow>
            </>
          ) : null}
        </>
      ) : null}
    </DocketSection>
  );
}