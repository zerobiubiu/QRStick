/**
 * 组装：顶栏正中是制作模式（单张 / 批量），右侧是出片条（出片 / 付印 / 交版），
 * 左侧是工单；批量模式下右边是可拖拽分栏的「数据表 | 多图预览」。
 *
 * 两种模式各自的排布是分开写的，不是靠隐藏几个组件凑出来：
 *  - 单张：工单 + 整张印张预览（刻度尺、套准十字、读数条）；
 *  - 批量：数据表（可拖拽排序 / 列宽可调 / 多选）+ 多图预览（单张突出或网格）。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { BatchPreviewGrid } from './components/BatchPreviewGrid';
import { BatchTable } from './components/BatchTable';
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog';
import { Docket } from './components/Docket';
import { PressSheet } from './components/PressSheet';
import { LineMark, StateLine } from './components/StateLine';
import { DEFAULT_CONFIG } from './state/persistence';
import { EXPORT_ACTION } from './export/run';
import { layoutLabel, validateLabel } from './lib/render';
import { buildRowConfig } from './lib/batch';
import { formatMm } from './lib/units';
import { useAppShortcuts } from './lib/useAppShortcuts';
import { useSplitDrag } from './lib/useSplitDrag';
import { useLabelStore } from './state/labelStore';
import { useExportActions, type TopAction } from './state/useExportActions';
import { type AppMode } from './state/types';
import { theme, MONO_FONT, FONT_PX } from './theme';
import type { LabelConfig } from './lib/types';

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
    onboardSeen,
    dismissOnboard,
  } = store;
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  // 分栏拖拽的指针事件与几何换算在 lib/useSplitDrag.ts
  const { containerRef: splitRef, startDrag: startSplit } = useSplitDrag(setSplitRatio);

  const layout = useMemo(() => layoutLabel(config), [config]);
  const issues = useMemo(() => {
    const list = validateLabel(config, layout);
    // 示例标注：标题与内容都还是出厂示例（一个字没改）时提醒一句——改掉任一处即消失
    if (config.title.text === DEFAULT_CONFIG.title.text && config.content === DEFAULT_CONFIG.content) {
      list.push({
        level: 'warn',
        message: `当前是示例数据（${DEFAULT_CONFIG.title.text} / ${DEFAULT_CONFIG.content}）：换成你自己的编号再出片。`,
      });
    }
    return list;
  }, [config, layout]);

  /** 批量模式下，单张预览跟着当前选中行走（行 → 配置走 lib/batch.ts 的唯一实现） */
  const previewConfig = useMemo<LabelConfig>(() => {
    if (mode !== 'batch' || !rows.length) return config;
    const row = rows.find((item) => item.index === selectedRow) ?? rows[0];
    return buildRowConfig(config, row);
  }, [config, mode, rows, selectedRow]);
  const previewLayoutInfo = useMemo(() => layoutLabel(previewConfig), [previewConfig]);
  const previewSignature = useMemo(() => JSON.stringify(previewConfig), [previewConfig]);

  const pickedRows = useMemo(() => {
    const picked = new Set(selectedIds);
    return rows.filter((row) => picked.has(row.index));
  }, [rows, selectedIds]);

  const imageLabel = `出片 ${imageExport.format.toUpperCase()}`;
  const imageModeLabel =
    imageExport.mode === 'each' ? '逐张' : imageExport.mode === 'zip' ? '打包 ZIP' : '拼接一张';

  /** 批量模式但一条数据都没有：三个导出动作没有目标，先禁用并在状态行说明 */
  const batchEmpty = mode === 'batch' && rows.length === 0;

  /** 三个动作的含义常驻可见：区别只放在 tooltip 里，触屏用户永远看不到 */
  const exportBrief = batchEmpty
    ? '批量模式还没有数据：导入 CSV / Excel 或粘贴两列，或者切回单张模式，再出片。'
    : mode === 'batch' && rows.length
      ? `出片：${imageExport.format.toUpperCase()} · ${imageModeLabel} · 出 ${
          pickedRows.length ? `选中的 ${pickedRows.length}` : `全部 ${rows.length}`
        } 张 · 付印 PDF / 交版 Word：每行一页，共 ${rows.length} 页 · 打印请设 100%，关闭「适应页面」`
      : `出片 ${imageExport.format.toUpperCase()}：按 DPI 原样出图（${layout.pixelWidth} × ${layout.pixelHeight} px）· 付印 PDF：一页一张，页面就是 ${formatMm(layout.sheetWidthMm)} × ${formatMm(layout.sheetHeightMm)} mm（打印请设 100%，关闭「适应页面」）· 交版 Word：标题是可编辑文字`;

  // 导出编排（含导出记录状态机与「参数一改就不再算已导出」）在 state/useExportActions.ts
  const { busy, handleExport } = useExportActions({
    mode,
    config,
    rows,
    pickedRows,
    selectedRow,
    imageExport,
    record,
    setRecord,
    imageLabel,
    imageModeLabel,
  });

  // Alt+1/2/3 导出、Alt+M 切模式；在输入框里打字时不抢键
  useAppShortcuts({
    bindings: SHORTCUTS,
    onExport: handleExport,
    onToggleMode: () => setMode(mode === 'batch' ? 'single' : 'batch'),
    // 与按钮同一条门槛：导出中或批量模式没有数据时，快捷键也不该另开一扇门
    enabled: !busy && !batchEmpty,
  });

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

  const flagged = issues.length > 0;
  // 首访上手条：只在「还没导出过任何东西」的空档出现；点「知道了」或第一次导出成功后收起并存本机
  const showOnboard = !onboardSeen && record.phase === 'idle';
  useEffect(() => {
    if (!onboardSeen && record.phase === 'done') dismissOnboard();
  }, [onboardSeen, record.phase, dismissOnboard]);

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
        '& .MuiToggleButton-root': { minHeight: 34, px: 2.5, fontSize: FONT_PX.body, fontWeight: 700, letterSpacing: '0.02em' },
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
            <Typography sx={{ fontSize: FONT_PX.wordmark, fontWeight: 700, letterSpacing: '-0.01em' }}>QRStick</Typography>
            <Typography sx={{ fontSize: FONT_PX.label, color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>
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
                    disabled={busy || batchEmpty}
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
        <Typography sx={{ fontSize: FONT_PX.meta, color: 'text.secondary', fontFamily: MONO_FONT, lineHeight: 1.5 }}>
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
          {showOnboard ? (
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                gap: 1.25,
                px: 2,
                py: 0.75,
                flex: '0 0 auto',
                bgcolor: 'var(--paper)',
                borderBottom: '1px solid var(--rule)',
              }}
            >
              <LineMark form="dashed" width={22} />
              <Typography sx={{ fontSize: FONT_PX.meta, color: 'text.secondary', minWidth: 0, lineHeight: 1.45 }}>
                示例标签：把工单里的标题与内容换成你的，点「付印 PDF」出来的就是能直接打印的 A4 标签
              </Typography>
              <Button size="small" variant="text" onClick={dismissOnboard} sx={{ ml: 'auto', flex: '0 0 auto' }}>
                知道了
              </Button>
            </Stack>
          ) : null}
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
            summary={`${layout.pixelWidth} × ${layout.pixelHeight} px · ${layout.qrModulePx} px/模块 · 纠错 ${layout.actualErrorCorrectionLevel}`}
          />
        </Box>
      </Box>

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}