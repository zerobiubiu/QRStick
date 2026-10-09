/**
 * 组装：顶栏是出片条（出片 / 付印 / 交版），左侧是工单，右侧是印张与读数。
 *
 * 窄屏时印张上移、工单下沉——优先级塌缩里，预览与导出永远不被挤掉。
 */
import { useCallback, useMemo } from 'react';
import { Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { BatchGrid } from './components/BatchGrid';
import { Docket } from './components/Docket';
import { PressSheet } from './components/PressSheet';
import { StateLine } from './components/StateLine';
import { EXPORT_ACTION, runExport, type ExportFormat } from './export/run';
import { layoutLabel, validateLabel } from './lib/render';
import { IDLE_EXPORT, useLabelStore, type AppMode } from './state/labelStore';
import { theme } from './theme';
import type { LabelConfig } from './lib/types';

const FORMATS: ExportFormat[] = ['png', 'pdf', 'word'];

const HINTS: Record<ExportFormat, string> = {
  png: '当前印张按 DPI 原样出图，像素尺寸就是读数里的数值',
  pdf: '一页一张标签，页面毫米尺寸与印张一致，可直接送印',
  word: '标题是可直接编辑的文字、二维码是图片，方便交给别人改字',
};

export default function App() {
  const store = useLabelStore();
  const { config, mode, rows, selectedRow, record, setRecord, setMode, setSelectedRow } = store;
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const wide = useMediaQuery(theme.breakpoints.up('lg'));

  const layout = useMemo(() => layoutLabel(config), [config]);
  const issues = useMemo(() => validateLabel(config, layout), [config, layout]);

  /** 批量模式下，印张预览跟着当前选中行走 */
  const previewConfig = useMemo<LabelConfig>(() => {
    if (mode !== 'batch' || !rows.length) return config;
    const row = rows.find((item) => item.index === selectedRow) ?? rows[0];
    return { ...config, title: { ...config.title, text: row.title }, content: row.content };
  }, [config, mode, rows, selectedRow]);
  const previewLayout = useMemo(() => layoutLabel(previewConfig), [previewConfig]);
  const previewSignature = useMemo(() => JSON.stringify(previewConfig), [previewConfig]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setRecord({ ...IDLE_EXPORT, phase: 'busy', action: EXPORT_ACTION[format] });
      try {
        const outcome = await runExport({ format, config, rows: mode === 'batch' ? rows : [], selectedRow }, (done, total) => {
          setRecord((prev) =>
            prev.phase === 'busy' && total > 1 ? { ...prev, action: `${EXPORT_ACTION[format]} ${done}/${total}` } : prev,
          );
        });
        setRecord({
          phase: 'done',
          at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          ...outcome,
        });
      } catch (cause) {
        setRecord({ ...IDLE_EXPORT, error: cause instanceof Error ? cause.message : '导出失败，请检查浏览器下载权限' });
      }
    },
    [config, mode, rows, selectedRow, setRecord],
  );

  const exportLabel = (format: ExportFormat) => {
    if (mode !== 'batch' || !rows.length) return EXPORT_ACTION[format];
    if (format === 'png') {
      const position = Math.max(1, rows.findIndex((item) => item.index === selectedRow) + 1);
      return `${EXPORT_ACTION[format]} · 第 ${position} 张`;
    }
    return `${EXPORT_ACTION[format]} · ${rows.length} 页`;
  };

  const busy = record.phase === 'busy';
  const flagged = issues.length > 0;

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Paper
        square
        component="header"
        sx={{ borderBottom: '1.5px solid', borderColor: 'text.primary', zIndex: 2, flex: '0 0 auto' }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 2, px: 2, py: 1, flexWrap: 'wrap' }}>
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>QRStick</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>码贴生成器 · 标题 + 内容 → 二维码标签</Typography>
          </Stack>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            aria-label="工作模式"
            onChange={(_event, next: AppMode | null) => {
              if (next) setMode(next);
            }}
          >
            <ToggleButton value="single">单张</ToggleButton>
            <ToggleButton value="batch">批量</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flex: 1, minWidth: 8 }} />

          <Stack direction="row" sx={{ gap: 1 }}>
            {FORMATS.map((format) => (
              <Tooltip key={format} title={HINTS[format]} arrow>
                <span>
                  <Button
                    size="small"
                    variant={format === 'pdf' ? 'contained' : 'outlined'}
                    disabled={busy}
                    onClick={() => void handleExport(format)}
                  >
                    {exportLabel(format)}
                  </Button>
                </span>
              </Tooltip>
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '392px minmax(0, 1fr)' },
          gridTemplateRows: { xs: 'auto auto', md: '1fr' },
          overflow: { xs: 'auto', md: 'hidden' },
        }}
      >
        <Box sx={{ order: { xs: 2, md: 1 }, display: 'flex', minHeight: 0 }}>
          <Docket store={store} compact={compact} issues={issues} />
        </Box>

        <Box sx={{ order: { xs: 1, md: 2 }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {mode === 'batch' ? (
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.3fr) minmax(0, 1fr)' },
              }}
            >
              <BatchGrid rows={rows} selectedRow={selectedRow} onSelect={setSelectedRow} />
              {wide ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: '1px solid var(--rule)' }}>
                  <PressSheet config={previewConfig} layout={previewLayout} signature={previewSignature} />
                </Box>
              ) : null}
            </Box>
          ) : (
            <PressSheet config={previewConfig} layout={previewLayout} signature={previewSignature} />
          )}

          {mode === 'batch' && !wide ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: 420, borderTop: '1px solid var(--rule)' }}>
              <PressSheet config={previewConfig} layout={previewLayout} signature={previewSignature} />
            </Box>
          ) : null}

          <StateLine
            record={record}
            flagged={flagged}
            summary={`${layout.pixelWidth} × ${layout.pixelHeight} px · ${layout.qrModulePx} px/模块 · 纠错 ${config.qr.errorCorrectionLevel}`}
          />
        </Box>
      </Box>
    </Box>
  );
}
