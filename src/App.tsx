/**
 * 组装：顶栏是出片条（出片 / 付印 / 交版），左侧是工单，右侧是印张与读数。
 *
 * 窄屏时印张上移、工单下沉——优先级塌缩里，预览与导出永远不被挤掉。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { BatchGrid } from './components/BatchGrid';
import { Docket } from './components/Docket';
import { PressSheet } from './components/PressSheet';
import { StateLine } from './components/StateLine';
import { EXPORT_ACTION, runExport, type ExportFormat } from './export/run';
import { layoutLabel, validateLabel } from './lib/render';
import { formatMm } from './lib/units';
import { IDLE_EXPORT, useLabelStore, type AppMode } from './state/labelStore';
import { theme, MONO_FONT } from './theme';
import type { LabelConfig } from './lib/types';

const FORMATS: ExportFormat[] = ['png', 'pdf', 'word'];

const HINTS: Record<ExportFormat, string> = {
  png: '当前印张按 DPI 原样出图，像素尺寸就是读数里的数值',
  pdf: '一页一张标签，页面毫米尺寸与印张一致，可直接送印',
  word: '标题是可直接编辑的文字、二维码是图片，方便交给别人改字',
};

/** 单个任务重复几十次时，键盘路径才是效率路径（Alt 组合不与浏览器快捷键打架） */
const SHORTCUTS: Record<string, ExportFormat> = { '1': 'png', '2': 'pdf', '3': 'word' };
const SHORTCUT_LABEL: Record<ExportFormat, string> = { png: 'Alt+1', pdf: 'Alt+2', word: 'Alt+3' };

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

  const [exportedKey, setExportedKey] = useState('');
  const configKey = useMemo(() => JSON.stringify(config), [config]);

  // 导出记录不能挂在改过的参数上：参数一变，上一次「已导出」就不再成立
  useEffect(() => {
    if (record.phase === 'done' && exportedKey && exportedKey !== configKey) setRecord(IDLE_EXPORT);
  }, [configKey, exportedKey, record.phase, setRecord]);

  /** 三个导出键的含义常驻可见：它们的区别只放在 tooltip 里，触屏用户永远看不到 */
  const exportBrief =
    mode === 'batch' && rows.length
      ? `付印 PDF / 交版 Word：每行一页，共 ${rows.length} 页 · 出片 PNG：只出当前选中那一行 · 打印请设 100%，关闭「适应页面」`
      : `出片 PNG：按 DPI 原样出图（${layout.pixelWidth} × ${layout.pixelHeight} px）· 付印 PDF：一页一张，页面就是 ${formatMm(layout.sheetWidthMm)} × ${formatMm(layout.sheetHeightMm)} mm（打印请设 100%，关闭「适应页面」）· 交版 Word：标题是可编辑文字`;

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
          note: format === 'pdf' ? '打印请设 100%，关闭「适应页面」缩放' : undefined,
          ...outcome,
        });
        setExportedKey(configKey);
      } catch (cause) {
        setRecord({ ...IDLE_EXPORT, error: cause instanceof Error ? cause.message : '无法写入下载文件，请检查浏览器的下载权限' });
      }
    },
    [config, mode, rows, selectedRow, setRecord],
  );

  // Alt+1/2/3 导出、Alt+M 切模式；在输入框里打字时不抢键
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const format = SHORTCUTS[event.key];
      if (format) {
        event.preventDefault();
        void handleExport(format);
        return;
      }
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setMode(mode === 'batch' ? 'single' : 'batch');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExport, mode, setMode]);

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
            aria-label="工作模式（Alt+M 切换）"
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
              <Tooltip key={format} title={`${HINTS[format]}（${SHORTCUT_LABEL[format]}）`} arrow>
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

      <Box sx={{ flex: '0 0 auto', px: 2, py: 0.5, bgcolor: 'var(--paper)', borderBottom: '1px solid var(--rule)' }}>
        <Typography sx={{ fontSize: 10.5, color: 'text.secondary', fontFamily: MONO_FONT, lineHeight: 1.5 }}>
          {exportBrief}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '392px minmax(0, 1fr)' },
          gridTemplateRows: { xs: 'max-content max-content', md: '1fr' },
          overflow: { xs: 'auto', md: 'hidden' },
        }}
      >
        <Box sx={{ order: { xs: 2, md: 1 }, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <Docket store={store} compact={compact} issues={issues} />
        </Box>

        <Box
          sx={{
            order: { xs: 1, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            // 窄屏这张列本身没有可分的剩余高度，必须自带高度：
            // 单张时给印张一个明确的台面；批量时让内容自己撑（数据表 + 预览各自带高度）
            height: { xs: mode === 'batch' ? 'auto' : 460, md: 'auto' },
          }}
        >
          {mode === 'batch' ? (
            <Box
              sx={{
                // 窄屏是单列 auto 行，分不到剩余高度：给数据表一个明确高度，
                // 并禁止它被同级内容压缩（flex-shrink 默认会把固定高度吃掉）
                flex: { xs: '0 0 auto', lg: 1 },
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.3fr) minmax(0, 1fr)' },
                height: { xs: 340, lg: 'auto' },
              }}
            >
              <BatchGrid
                rows={rows}
                selectedRow={selectedRow}
                onSelect={setSelectedRow}
                onAddRow={store.addRow}
                onEditRow={store.updateRow}
                onRemoveRow={store.removeRow}
              />
              {wide ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: '1px solid var(--rule)' }}>
                  <PressSheet config={previewConfig} layout={previewLayout} signature={previewSignature} />
                </Box>
              ) : null}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <PressSheet config={previewConfig} layout={previewLayout} signature={previewSignature} />
            </Box>
          )}

          {mode === 'batch' && !wide ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: 360, flex: '0 0 auto', borderTop: '1px solid var(--rule)' }}>
              <PressSheet config={previewConfig} layout={previewLayout} signature={previewSignature} />
            </Box>
          ) : null}

          <StateLine
            record={record}
            flagged={flagged}
            reason={issues.length ? issues[0].message : undefined}
            summary={`${layout.pixelWidth} × ${layout.pixelHeight} px · ${layout.qrModulePx} px/模块 · 纠错 ${config.qr.errorCorrectionLevel}`}
          />
        </Box>
      </Box>
    </Box>
  );
}
