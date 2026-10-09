/**
 * 组装：顶栏正中是制作模式（单张 / 批量），右侧是出片条（出片 / 付印 / 交版），
 * 左侧是工单；批量模式下右边是可拖拽分栏的「数据表 | 多图预览」。
 *
 * 两种模式各自的排布是分开写的，不是靠隐藏几个组件凑出来：
 *  - 单张：工单 + 整张印张预览（刻度尺、套准十字、读数条）；
 *  - 批量：数据表（可拖拽排序 / 列宽可调 / 多选）+ 多图预览（单张突出或网格）。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { BatchPreviewGrid } from './components/BatchPreviewGrid';
import { BatchTable } from './components/BatchTable';
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog';
import { Docket } from './components/Docket';
import { PressSheet } from './components/PressSheet';
import { StateLine } from './components/StateLine';
import { EXPORT_ACTION, runExport, type ExportFormat } from './export/run';
import { runImageExport } from './export/runImage';
import { layoutLabel, validateLabel } from './lib/render';
import { formatMm } from './lib/units';
import { IDLE_EXPORT, useLabelStore, type AppMode } from './state/labelStore';
import { theme, MONO_FONT } from './theme';
import type { LabelConfig } from './lib/types';

/** 顶栏三个动作：出片走图片导出（格式/模式可配），另两个是文档导出 */
type TopAction = 'image' | 'pdf' | 'word';

const ACTIONS: TopAction[] = ['image', 'pdf', 'word'];

const HINTS: Record<TopAction, string> = {
  image: '按 DPI 原样出图；批量时可逐张保存、打包成 ZIP 或拼接成一张',
  pdf: '一页一张标签，页面毫米尺寸与印张一致，可直接送印',
  word: '标题是可直接编辑的文字、二维码是图片，方便交给别人改字',
};

/** 单个任务重复几十次时，键盘路径才是效率路径（Alt 组合不与浏览器快捷键打架） */
const SHORTCUTS: Record<string, TopAction> = { '1': 'image', '2': 'pdf', '3': 'word' };
const SHORTCUT_LABEL: Record<TopAction, string> = { image: 'Alt+1', pdf: 'Alt+2', word: 'Alt+3' };

export default function App() {
  const store = useLabelStore();
  const {
    config,
    mode,
    rows,
    selectedRow,
    selectedIds,
    record,
    setRecord,
    setMode,
    imageExport,
    splitRatio,
    setSplitRatio,
  } = store;
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const splitRef = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => layoutLabel(config), [config]);
  const issues = useMemo(() => validateLabel(config, layout), [config, layout]);

  /** 批量模式下，单张预览跟着当前选中行走 */
  const previewConfig = useMemo<LabelConfig>(() => {
    if (mode !== 'batch' || !rows.length) return config;
    const row = rows.find((item) => item.index === selectedRow) ?? rows[0];
    return { ...config, title: { ...config.title, text: row.title }, content: row.content };
  }, [config, mode, rows, selectedRow]);
  const previewLayoutInfo = useMemo(() => layoutLabel(previewConfig), [previewConfig]);
  const previewSignature = useMemo(() => JSON.stringify(previewConfig), [previewConfig]);

  const [exportedKey, setExportedKey] = useState('');
  const configKey = useMemo(() => JSON.stringify(config), [config]);

  // 导出记录不能挂在改过的参数上：参数一变，上一次「已导出」就不再成立
  useEffect(() => {
    if (record.phase === 'done' && exportedKey && exportedKey !== configKey) setRecord(IDLE_EXPORT);
  }, [configKey, exportedKey, record.phase, setRecord]);

  const pickedRows = useMemo(() => rows.filter((row) => selectedIds.includes(row.index)), [rows, selectedIds]);

  const imageLabel = `出片 ${imageExport.format.toUpperCase()}`;
  const imageModeLabel =
    imageExport.mode === 'each' ? '逐张' : imageExport.mode === 'zip' ? '打包 ZIP' : '拼接一张';

  /** 三个动作的含义常驻可见：区别只放在 tooltip 里，触屏用户永远看不到 */
  const exportBrief =
    mode === 'batch' && rows.length
      ? `出片：${imageExport.format.toUpperCase()} · ${imageModeLabel} · 出 ${
          pickedRows.length ? `选中的 ${pickedRows.length}` : `全部 ${rows.length}`
        } 张 · 付印 PDF / 交版 Word：每行一页，共 ${rows.length} 页 · 打印请设 100%，关闭「适应页面」`
      : `出片 ${imageExport.format.toUpperCase()}：按 DPI 原样出图（${layout.pixelWidth} × ${layout.pixelHeight} px）· 付印 PDF：一页一张，页面就是 ${formatMm(layout.sheetWidthMm)} × ${formatMm(layout.sheetHeightMm)} mm（打印请设 100%，关闭「适应页面」）· 交版 Word：标题是可编辑文字`;

  const handleImageExport = useCallback(async () => {
    const action = `${imageLabel}（${imageModeLabel}）`;
    setRecord({ ...IDLE_EXPORT, phase: 'busy', action });
    try {
      const result = await runImageExport({
        config,
        rows: mode === 'batch' ? rows : [],
        picked: mode === 'batch' ? pickedRows : [],
        options: imageExport,
        onProgress: (_done, total, note) =>
          setRecord((prev) => (prev.phase === 'busy' && total > 1 ? { ...prev, action: `${action} ${note}` } : prev)),
      });
      setRecord({
        phase: 'done',
        at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        action: result.action,
        fileName: result.fileName,
        pages: result.pages,
        note: result.failed.length ? `${result.failed.length} 张失败：${result.failed[0]}` : undefined,
      });
      setExportedKey(configKey);
    } catch (cause) {
      setRecord({ ...IDLE_EXPORT, error: cause instanceof Error ? cause.message : '无法写入下载文件，请检查浏览器的下载权限' });
    }
  }, [config, configKey, imageExport, imageLabel, imageModeLabel, mode, pickedRows, rows, setRecord]);

  const handleExport = useCallback(
    async (action: TopAction) => {
      if (action === 'image') {
        await handleImageExport();
        return;
      }
      const format: ExportFormat = action;
      setRecord({ ...IDLE_EXPORT, phase: 'busy', action: EXPORT_ACTION[format] });
      try {
        const outcome = await runExport(
          { format, config, rows: mode === 'batch' ? (pickedRows.length ? pickedRows : rows) : [], selectedRow },
          (done, total) => {
            setRecord((prev) =>
              prev.phase === 'busy' && total > 1 ? { ...prev, action: `${EXPORT_ACTION[format]} ${done}/${total}` } : prev,
            );
          },
        );
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
    [config, configKey, handleImageExport, mode, pickedRows, rows, selectedRow, setRecord],
  );

  // Alt+1/2/3 导出、Alt+M 切模式；在输入框里打字时不抢键
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const action = SHORTCUTS[event.key];
      if (action) {
        event.preventDefault();
        void handleExport(action);
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

  const requestRowDelete = useCallback(
    (indexes: number[]) => {
      const targets = rows.filter((row) => indexes.includes(row.index));
      if (!targets.length) return;
      setConfirm({
        title: indexes.length === 1 ? `删除第 ${indexes[0]} 行` : `删除 ${indexes.length} 行数据`,
        detail: '删除后行号会重排；这一步不能撤销（已经导出的文件不受影响）。',
        items: targets.map((row) => `${row.index}. ${row.title || '（无标题）'} → ${row.content || '（内容为空）'}`),
        confirmLabel: indexes.length === 1 ? '删除这一行' : `删除 ${indexes.length} 行`,
        onConfirm: () => store.removeRows(indexes),
      });
    },
    [rows, store],
  );

  const startSplit = (event: React.PointerEvent) => {
    const container = splitRef.current;
    if (!container) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent) => setSplitRatio((moveEvent.clientX - rect.left) / rect.width);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const busy = record.phase === 'busy';
  const flagged = issues.length > 0;

  const modeSwitch = (
    <ToggleButtonGroup
      exclusive
      value={mode}
      aria-label="制作模式（Alt+M 切换）"
      onChange={(_event, next: AppMode | null) => {
        if (next) setMode(next);
      }}
      sx={{
        bgcolor: 'var(--paper)',
        '& .MuiToggleButton-root': { minHeight: 34, px: 2.5, fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' },
      }}
    >
      <ToggleButton value="single">单张</ToggleButton>
      <ToggleButton value="batch">批量</ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Paper
        square
        component="header"
        sx={{ borderBottom: '1.5px solid', borderColor: 'text.primary', zIndex: 4, flex: '0 0 auto' }}
      >
        <Box
          sx={{
            display: 'grid',
            // 左中右三栏：中间那栏恒定居中，不受两侧内容宽窄影响
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) auto minmax(0, 1fr)' },
            alignItems: 'center',
            gap: { xs: 0.75, sm: 2 },
            px: 2,
            py: 0.75,
          }}
        >
          <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1, minWidth: 0, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>QRStick</Typography>
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>
              码贴生成器 · 标题 + 内容 → 二维码标签
            </Typography>
          </Stack>

          <Box sx={{ justifySelf: 'center' }}>{modeSwitch}</Box>

          <Stack direction="row" sx={{ gap: 1, justifySelf: 'end', flexWrap: 'wrap', justifyContent: 'center' }}>
            {ACTIONS.map((action) => (
              <Tooltip key={action} title={`${HINTS[action]}（${SHORTCUT_LABEL[action]}）`} arrow>
                <span>
                  <Button
                    size="small"
                    variant={action === 'pdf' ? 'contained' : 'outlined'}
                    disabled={busy}
                    onClick={() => void handleExport(action)}
                  >
                    {action === 'image'
                      ? imageLabel
                      : mode === 'batch' && rows.length
                        ? `${EXPORT_ACTION[action]} · ${(pickedRows.length || rows.length)} 页`
                        : EXPORT_ACTION[action]}
                  </Button>
                </span>
              </Tooltip>
            ))}
          </Stack>
        </Box>
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
          <Docket store={store} compact={compact} issues={issues} confirm={setConfirm} />
        </Box>

        <Box
          sx={{
            order: { xs: 1, md: 2 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            height: { xs: mode === 'batch' ? 'auto' : 460, md: 'auto' },
          }}
        >
          {mode === 'batch' ? (
            <Box
              ref={splitRef}
              sx={{
                flex: { xs: '0 0 auto', lg: 1 },
                minHeight: 0,
                display: 'grid',
                // 分栏比例来自 store（拖拽调整并持久化）：数据表 | 分隔条 | 多图预览
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: `${Math.round(splitRatio * 100)}% 6px minmax(0, 1fr)`,
                },
                gridTemplateRows: { xs: 'max-content max-content', lg: '1fr' },
                height: { xs: 'auto', lg: 'auto' },
              }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: { xs: 320, lg: 'auto' } }}>
                <BatchTable store={store} onRequestDelete={requestRowDelete} />
              </Box>

              {wide ? (
                <Box
                  role="separator"
                  aria-label="调整数据表与预览的宽度"
                  aria-orientation="vertical"
                  tabIndex={0}
                  onPointerDown={startSplit}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft') setSplitRatio(splitRatio - 0.03);
                    if (event.key === 'ArrowRight') setSplitRatio(splitRatio + 0.03);
                  }}
                  sx={{
                    cursor: 'col-resize',
                    bgcolor: 'var(--ground)',
                    borderLeft: '1px solid var(--rule)',
                    borderRight: '1px solid var(--rule)',
                    '&:hover, &:focus-visible': { bgcolor: 'var(--cyan)' },
                  }}
                />
              ) : null}

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  borderLeft: { xs: 'none', lg: '1px solid var(--rule)' },
                  height: { xs: 420, lg: 'auto' },
                }}
              >
                <BatchPreviewGrid
                  store={store}
                  baseConfig={config}
                  selectedConfig={previewConfig}
                  selectedLayout={previewLayoutInfo}
                  selectedSignature={previewSignature}
                />
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
              <PressSheet
                config={previewConfig}
                layout={previewLayoutInfo}
                signature={previewSignature}
                zoom={store.previewZoom}
                onZoomChange={store.setPreviewZoom}
              />
            </Box>
          )}

          <StateLine
            record={record}
            flagged={flagged}
            reason={issues.length ? issues[0].message : undefined}
            summary={`${layout.pixelWidth} × ${layout.pixelHeight} px · ${layout.qrModulePx} px/模块 · 纠错 ${config.qr.errorCorrectionLevel}`}
          />
        </Box>
      </Box>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}