/**
 * 样式预设段：存下当前这套（整套 / 只样式）、套用、删除，以及跨机器的文件导入导出。
 *
 * 文件那一半（选文件、解析、下载、就地提示）在 `lib/usePresetTransfer.ts`，
 * 这里只把它接上按钮与列表，不自己碰浏览器文件接口。
 */
import { useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type { PresetScope } from '../../lib/types';
import type { LabelPreset } from '../../state/types';
import type { PresetFileEntry } from '../../lib/presetFile';
import { usePresetTransfer } from '../../state/usePresetTransfer';
import { MONO_FONT } from '../../theme';
import type { ConfirmRequest } from '../ConfirmDialog';
import { DocketSection, FieldRow, Segmented } from './fields';

export function PresetSection({
  presets,
  savePreset,
  applyPreset,
  deletePreset,
  importPresets,
  confirm,
}: {
  presets: LabelPreset[];
  savePreset: (name: string, scope: PresetScope) => void;
  applyPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  importPresets: (entries: PresetFileEntry[]) => { added: number; replaced: number };
  confirm: (request: ConfirmRequest) => void;
}) {
  const [presetName, setPresetName] = useState('');
  const [presetScope, setPresetScope] = useState<PresetScope>('full');
  const { notice, notify, inputRef, openPicker, onFileChange, exportFile } = usePresetTransfer({ presets, importPresets });

  return (
    <DocketSection title="样式预设" meta={presets.length ? `${presets.length} 套` : '未保存'}>
      <FieldRow label="存下这套" hint="整套 = 纸张 + 样式；只样式 = 标题格式 / 二维码参数 / 印刷标记 / 版式站位（不动纸张与页边距）">
        <Stack direction="row" sx={{ gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented<PresetScope>
            ariaLabel="预设存档范围"
            value={presetScope}
            options={[
              { value: 'full', label: '整套' },
              { value: 'style', label: '只样式' },
            ]}
            onChange={setPresetScope}
          />
          <TextField
            size="small"
            value={presetName}
            placeholder="名称，例如「A4 工单」"
            onChange={(event) => setPresetName(event.target.value)}
            slotProps={{ htmlInput: { 'aria-label': '预设名称' } }}
            sx={{ flex: 1, minWidth: 96 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              savePreset(presetName, presetScope);
              notify(`已保存「${presetName.trim() || '未命名预设'}」`);
              setPresetName('');
            }}
          >
            保存
          </Button>
        </Stack>
      </FieldRow>

      <FieldRow label="导入导出" hint="导出一个 JSON 文件就能带到别的机器（内网多台各存各的问题一次解决）；导入时同名覆盖">
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" disabled={!presets.length} onClick={exportFile}>
            导出预设文件
          </Button>
          <Button size="small" variant="outlined" onClick={openPicker}>
            导入预设文件
          </Button>
        </Stack>
      </FieldRow>
      <input ref={inputRef} type="file" accept=".json,application/json" hidden onChange={onFileChange} />

      {notice ? (
        <Box sx={{ px: 2, py: 0.75, borderBottom: '1px solid var(--rule)' }}>
          <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary' }}>{notice}</Typography>
        </Box>
      ) : null}

      {presets.length ? (
        presets.map((preset) => (
          <FieldRow
            key={preset.id}
            label={preset.name}
            hint={`${preset.scope === 'style' ? '只样式' : '整套'} · 保存于 ${preset.savedAt}`}
          >
            <Stack direction="row" sx={{ gap: 0.75 }}>
              <Button size="small" variant="outlined" onClick={() => applyPreset(preset.id)}>
                套用
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() =>
                  confirm({
                    title: `删除预设「${preset.name}」`,
                    detail: '只删本机这一套；已经导出成文件的预设不受影响。',
                    items: [`${preset.name} · ${preset.scope === 'style' ? '只样式' : '整套'} · 保存于 ${preset.savedAt}`],
                    confirmLabel: '删除预设',
                    onConfirm: () => deletePreset(preset.id),
                  })
                }
              >
                删除
              </Button>
            </Stack>
          </FieldRow>
        ))
      ) : (
        <Box sx={{ px: 2, py: 0.75 }}>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>
            还没有预设：同一种标签每天都要出的话，把现在这套存下来；也可以导入别人导出的预设文件。
          </Typography>
        </Box>
      )}
    </DocketSection>
  );
}