/**
 * 批量模式的多图预览：单张突出 / 多张网格两种排布，区域内独立滚动。
 *
 * 三处关键行为：
 *  - **数据绑定稳**：每格内容完全由「当前 rows 里那一行」推导（标题 + 内容 + config 指纹），
 *    不缓存过期缩略图——改内容、排序、删行之后图片必然跟着变，不会出现图文错位；
 *  - **懒渲染**：格子进入视口附近才渲染画布，离开就释放，因此几百行也不会把内存吃满；
 *  - **失败隔离**：某一格渲染失败只影响那一格，并在格子里写清是第几行出错。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { layoutLabel, renderLabel } from '../lib/render';
import { THUMB_MAX_PX, previewScaleFor } from '../lib/preview';
import { formatMm } from '../lib/units';
import type { BatchRow, LabelConfig, PreviewLayout } from '../lib/types';
import { INK, MONO_FONT } from '../theme';

/** 超过这个张数只渲染前 N 张预览（导出不受影响） */
const PREVIEW_CAP = 200;

function buildRowConfig(config: LabelConfig, row: BatchRow): LabelConfig {
  return { ...config, title: { ...config.title, text: row.title }, content: row.content };
}

function Tile({
  row,
  config,
  fingerprint,
  selected,
  onSelect,
}: {
  row: BatchRow;
  config: LabelConfig;
  fingerprint: string;
  selected: boolean;
  onSelect: (index: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const aspect = useMemo(() => {
    const layout = layoutLabel(config);
    return `${layout.sheetWidthMm} / ${layout.sheetHeightMm}`;
  }, [config]);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    const holder = holderRef.current;
    if (!visible || !holder) return;
    let message = '';
    try {
      const rowConfig = buildRowConfig(config, row);
      const scale = previewScaleFor(layoutLabel(rowConfig), THUMB_MAX_PX);
      const { canvas } = renderLabel(rowConfig, scale);
      holder.replaceChildren(canvas);
    } catch (cause) {
      message = cause instanceof Error ? cause.message : '渲染失败';
    }
    // 画布渲染只能在 DOM 就绪后做（不能在渲染期），失败信息要落进界面状态
    // oxlint-disable-next-line react/set-state-in-effect
    setError((prev) => (prev === message ? prev : message));
    return () => {
      holder.replaceChildren();
    };
    // fingerprint 覆盖 config 的变化；行标题/内容变化必须重渲染，否则就是过期缩略图
  }, [visible, row.title, row.content, fingerprint, config, row]);

  return (
    <Box
      ref={wrapperRef}
      onMouseDown={() => onSelect(row.index)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 0.75,
        bgcolor: 'var(--paper)',
        border: `1px solid ${selected ? INK : 'var(--rule)'}`,
        cursor: 'pointer',
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: aspect, bgcolor: 'var(--ground)' }}>
        {error ? (
          <Stack sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', px: 1 }}>
            <Typography sx={{ fontSize: 10.5, color: 'text.primary', textAlign: 'center' }}>第 {row.index} 行渲染失败</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', textAlign: 'center' }}>{error}</Typography>
          </Stack>
        ) : (
          <Box ref={holderRef} sx={{ position: 'absolute', inset: 0, '& canvas': { display: 'block', width: '100%', height: '100%' } }} />
        )}
        {!visible && !error ? (
          <Stack sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>第 {row.index} 行待渲染</Typography>
          </Stack>
        ) : null}
      </Box>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 0.5 }}>
        <Typography
          sx={{
            fontSize: 10.5,
            fontFamily: MONO_FONT,
            fontWeight: selected ? 700 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.title || '（无标题）'}
        </Typography>
        <Typography sx={{ fontSize: 10, fontFamily: MONO_FONT, color: 'text.secondary', flex: '0 0 auto' }}>
          #{row.index}
        </Typography>
      </Stack>
    </Box>
  );
}

export function BatchPreviewGrid({
  rows,
  config,
  selectedIndex,
  onSelect,
  layout,
  onLayoutChange,
}: {
  rows: BatchRow[];
  config: LabelConfig;
  selectedIndex: number;
  onSelect: (index: number) => void;
  layout: PreviewLayout;
  onLayoutChange: (layout: PreviewLayout) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fingerprint = useMemo(() => JSON.stringify(config), [config]);
  const shown = rows.slice(0, PREVIEW_CAP);
  const selectedRow = rows.find((row) => row.index === selectedIndex) ?? rows[0] ?? null;
  const selectedLayout = useMemo(() => (selectedRow ? layoutLabel(buildRowConfig(config, selectedRow)) : null), [config, selectedRow]);

  const step = useCallback(
    (delta: number) => {
      if (!rows.length) return;
      const position = Math.max(0, rows.findIndex((row) => row.index === selectedIndex));
      const next = rows[Math.min(rows.length - 1, Math.max(0, position + delta))];
      if (next) onSelect(next.index);
    },
    [onSelect, rows, selectedIndex],
  );

  // 可见范围读数：按格子高度估个区间即可，不用为了一个读数再测一遍 DOM
  const perRow = 3;
  const firstVisible = rows.length ? Math.min(rows.length, Math.floor(scrollTop / 220) * perRow + 1) : 0;
  const lastVisible = rows.length ? Math.min(rows.length, firstVisible + perRow * 2) : 0;

  return (
    <Stack sx={{ minHeight: 0, flex: 1, bgcolor: 'var(--paper)' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          py: 0.5,
          bgcolor: 'rgba(16,16,16,0.035)',
          borderBottom: '1px solid var(--rule)',
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>预览</Typography>
          <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary' }}>
            {rows.length ? `${rows.length} 张` : '无数据'}
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          {layout === 'single' && selectedRow ? (
            <>
              <Button size="small" variant="text" onClick={() => step(-1)} sx={{ minHeight: 22 }}>
                ‹ 上一张
              </Button>
              <Button size="small" variant="text" onClick={() => step(1)} sx={{ minHeight: 22 }}>
                下一张 ›
              </Button>
            </>
          ) : (
            <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
              第 {firstVisible}–{lastVisible} 张 / 共 {rows.length}
            </Typography>
          )}
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>排布</Typography>
            {(['single', 'grid'] as PreviewLayout[]).map((option) => (
              <Button
                key={option}
                size="small"
                variant={layout === option ? 'contained' : 'outlined'}
                aria-pressed={layout === option}
                aria-label={option === 'single' ? '预览排布：单张突出' : '预览排布：多张网格'}
                onClick={() => onLayoutChange(option)}
                sx={{ minHeight: 22, borderRadius: 0, minWidth: 72 }}
              >
                {option === 'single' ? '单张突出' : '多张网格'}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 3 }}>
          <Typography sx={{ fontSize: 12.5 }}>还没有可预览的标签</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>
            先导入数据或新增一行；每来一行，这里就多一张对应的标签
          </Typography>
        </Stack>
      ) : layout === 'single' && selectedRow ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
            <Box sx={{ width: '100%', maxWidth: 520, maxHeight: '100%', aspectRatio: '210 / 297' }}>
              <Tile row={selectedRow} config={config} fingerprint={fingerprint} selected onSelect={onSelect} />
            </Box>
          </Box>
          {selectedLayout ? (
            <Stack direction="row" sx={{ gap: 1.5, px: 1.5, py: 0.75, borderTop: '1px solid var(--rule)', flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary' }}>
                第 {selectedRow.index} 行 · {selectedRow.title || '（无标题）'}
              </Typography>
              <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary' }}>
                {formatMm(selectedLayout.sheetWidthMm)} × {formatMm(selectedLayout.sheetHeightMm)} mm · 外框{' '}
                {selectedLayout.qrActualMm.toFixed(1)} mm · 码面 {selectedLayout.qrInkMm.toFixed(1)} mm
              </Typography>
            </Stack>
          ) : null}
        </Box>
      ) : (
        <Box
          ref={scrollRef}
          onScroll={(event) => setScrollTop((event.target as HTMLElement).scrollTop)}
          sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1, bgcolor: 'var(--ground)' }}
        >
          {rows.length > PREVIEW_CAP ? (
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', px: 0.5, pb: 1 }}>
              仅预览前 {PREVIEW_CAP} 张（导出的仍是全部 {rows.length} 张）
            </Typography>
          ) : null}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
              gap: 1,
              alignContent: 'start',
            }}
          >
            {shown.map((row) => (
              <Tile
                key={row.index}
                row={row}
                config={config}
                fingerprint={fingerprint}
                selected={row.index === selectedIndex}
                onSelect={onSelect}
              />
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}