/**
 * 工单：参数的唯一入口。本文件只负责把各段拼起来，不写任何字段本身。
 *
 * 每一段都是 `components/docket/` 下的独立组件，各自只认自己那部分配置与 patch 回调
 * （改纸张不会牵动标题或二维码）；字段原语（FieldRow 等）在同目录的 `fields.tsx`。
 * 这里保留的只有：批量数据源、段的顺序、体检常驻底栏与「恢复默认」。
 */
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import type { ConfirmRequest } from './ConfirmDialog';
import type { LabelIssue } from '../lib/render';
import type { LabelStore } from '../state/labelStore';
import { BatchSource } from './BatchSource';
import { LineMark } from './StateLine';
import { ExportSection } from './docket/ExportSection';
import { PaperSection } from './docket/PaperSection';
import { PresetSection } from './docket/PresetSection';
import { QrSection } from './docket/QrSection';
import { TitleSection } from './docket/TitleSection';
import { INK, MONO_FONT, PAPER, FONT_PX } from '../theme';

export function Docket({
  store,
  compact,
  issues,
  confirm,
}: {
  store: LabelStore;
  compact: boolean;
  issues: LabelIssue[];
  confirm: (request: ConfirmRequest) => void;
}) {
  const { config } = store;

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
        {/* 批量模式下数据源就是首要任务，排在最前 */}
        {store.mode === 'batch' ? <BatchSource store={store} confirm={confirm} /> : null}

        <PresetSection
          presets={store.presets}
          savePreset={store.savePreset}
          applyPreset={store.applyPreset}
          deletePreset={store.deletePreset}
          importPresets={store.importPresets}
          confirm={confirm}
        />
        <PaperSection page={config.page} onPatch={store.patchPage} />
        <TitleSection title={config.title} onPatch={store.patchTitle} />
        <QrSection
          qr={config.qr}
          marks={config.marks}
          content={config.content}
          compact={compact}
          onPatchQr={store.patchQr}
          onPatchMarks={store.patchMarks}
          onContent={store.setContent}
        />
        <ExportSection imageExport={store.imageExport} mode={store.mode} onPatch={store.setImageExport} />
      </Box>

      {/* 体检常驻底栏：它是提醒的唯一解释处，不能停在滚动区最底部 */}
      <Box sx={{ mt: 'auto', borderTop: `1.5px solid ${INK}`, bgcolor: 'var(--tint-footer)' }}>
        {/* 体检只列状态行没在说的那些：首条已经在状态行上，同屏不重复 */}
        {issues.length > 1 ? (
          <Box sx={{ borderBottom: '1px solid var(--rule)', maxHeight: 140, overflowY: 'auto', px: 2, py: 0.75 }}>
            <Typography sx={{ fontSize: FONT_PX.meta, fontFamily: MONO_FONT, color: 'text.secondary', mb: 0.25 }}>
              体检 · {issues.filter((item) => item.level === 'error').length} 错 ·{' '}
              {issues.filter((item) => item.level === 'warn').length} 警（首条见右下状态行）
            </Typography>
            {issues.slice(1).map((issue, index) => (
              <Stack key={`${index}-${issue.message}`} direction="row" sx={{ gap: 1, alignItems: 'flex-start', py: 0.25 }}>
                <Box sx={{ pt: 0.75 }}>
                  <LineMark form={issue.level === 'error' ? 'double' : 'dashed'} width={22} />
                </Box>
                <Typography sx={{ fontSize: FONT_PX.label, lineHeight: 1.45, color: 'text.primary' }}>{issue.message}</Typography>
              </Stack>
            ))}
          </Box>
        ) : null}
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 2, py: 1.25 }}>
          <Typography sx={{ fontSize: FONT_PX.meta, color: 'text.secondary' }}>
            参数改动即时重排印张，没有「应用」这一步。
          </Typography>
          <Tooltip title="恢复到出厂的默认参数；批量数据不会被删除">
            <Button size="small" variant="outlined" onClick={store.reset}>
              恢复默认
            </Button>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}