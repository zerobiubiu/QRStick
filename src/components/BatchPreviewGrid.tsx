/**
 * 批量模式的预览区：单张突出（复用 PressSheet 本体）/ 多张网格。
 *
 * 三条纪律：
 *  - **单张预览与单张制作模式是同一个组件**：调用 PressSheet，缩放、读数条、刻度尺、套准十字全都一致，
 *    不存在「两套预览各写一遍」的视觉差异；批量单张只是把它的 config 换成当前选中行；
 *  - **不裁切、不变形**：每格的画布按标签自身宽高比落进媒体框（`object-fit: contain`），
 *    网格列宽用 `minmax(0, 1fr)`，卡片不能被内容撑破；
 *  - **位置记忆**：网格滚动位置存在 ref 里（跨排布切换存活），返回网格时恢复到原来的浏览位置。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { PressSheet } from './PressSheet';
import { layoutLabel, renderLabel, type LabelLayout } from '../lib/render';
import { THUMB_MAX_PX, previewScaleFor } from '../lib/preview';
import { buildRowConfig } from '../lib/batch';
import type { BatchRow, LabelConfig } from '../lib/types';
import type { LabelStore } from '../state/labelStore';
import { INK, MONO_FONT } from '../theme';

/** 超过这个张数只渲染前 N 张预览（导出不受影响） */
const PREVIEW_CAP = 200;
/** 估范围用的单格高度（像素）：只为「第 X–Y 张」这个读数服务 */
const TILE_STRIDE_PX = 240;

/**
 * 每帧最多出片几张缩略图。
 *
 * 参数一改（拖滑杆），所有已可见的格子会在同一个提交里同步 renderLabel，
 * 两百张挤一帧就把主线程按住不放。这里把所有出片意图收进一个队列摊到动画帧上：
 * 同一格只保留最新意图（旧的一律作废），队列不空就一直排下一帧——最后一帧一定出片。
 */
const THUMB_PER_FRAME = 4;

/** 待出片的格子：键是格子的稳定身份，值是这一格「最新的出片意图」 */
const thumbBacklog = new Map<object, () => void>();
let thumbFrame = 0;

function pumpThumbs() {
  if (thumbFrame !== 0) return;
  thumbFrame = requestAnimationFrame(() => {
    thumbFrame = 0;
    for (const [key, draw] of [...thumbBacklog].slice(0, THUMB_PER_FRAME)) {
      thumbBacklog.delete(key);
      draw();
    }
    if (thumbBacklog.size) pumpThumbs();
  });
}

/** 登记一格的最新出片意图；已有同一格的意图直接顶掉（过期帧不浪费一次出片） */
function queueThumb(key: object, draw: () => void) {
  thumbBacklog.set(key, draw);
  pumpThumbs();
}

/** 撤下这一格的意图（离屏或卸载时）：离屏的格子不该占出片机会 */
function dropThumb(key: object) {
  thumbBacklog.delete(key);
}

/** 网格里的一格：媒体框按此行标签的自身宽高比，画布 object-fit 放入 → 不拉伸、不裁切 */
function Tile({
  row,
  config,
  aspect,
  fingerprint,
  selected,
  onSelect,
  onOpen,
}: {
  row: BatchRow;
  config: LabelConfig;
  /** 媒体框的比例：只跟纸张参数有关（行数据只覆盖标题与内容），父级算一次传进来 */
  aspect: string;
  fingerprint: string;
  selected: boolean;
  onSelect: (index: number) => void;
  onOpen: (index: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  // 这一格在出片队列里的身份：稳定键，重复登记只保留最新意图
  const tileKey = useRef<object>({});
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');

  // 进视野、出视野都要认：离屏即回收画布（一张缩略图约 1.6 MB，两百张常驻就是几百兆）
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        setVisible((prev) => (prev === entry.isIntersecting ? prev : entry.isIntersecting));
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const holder = holderRef.current;
    const key = tileKey.current;
    if (!visible) {
      // 离屏回收：画布不再常驻，滚回来时按当前参数重新出一张
      holder?.replaceChildren();
      return;
    }
    if (!holder) return;
    // 出片摊到动画帧上（见 queueThumb）：参数连着改时不会把几百张挤进同一个提交
    queueThumb(key, () => {
      let message = '';
      try {
        const rowConfig = buildRowConfig(config, row);
        const scale = previewScaleFor(layoutLabel(rowConfig), THUMB_MAX_PX);
        const { canvas, failure } = renderLabel(rowConfig, scale);
        // 分配不出画布的行不挂空白画布：说清原因，别让人把空白当成印出来的样子
        if (failure === 'canvas_unavailable') {
          holder.replaceChildren();
          message = '画布太大，浏览器分配不出：降低 DPI 或缩小纸张';
        } else {
          holder.replaceChildren(canvas);
        }
      } catch (cause) {
        holder.replaceChildren();
        message = cause instanceof Error ? cause.message : '出片时出了状况';
      }
      setError((prev) => (prev === message ? prev : message));
    });
    return () => {
      dropThumb(key);
    };
    // fingerprint 覆盖 config 的变化；行标题/内容变化必须重渲染，否则就是过期缩略图
  }, [visible, row.title, row.content, fingerprint, config, row]);

  return (
    <Box
      ref={wrapperRef}
      role="button"
      tabIndex={0}
      aria-label={`第 ${row.index} 行预览${selected ? '（当前）' : ''}`}
      onClick={() => onSelect(row.index)}
      onDoubleClick={() => onOpen(row.index)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(row.index);
        }
      }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        p: 0.75,
        minWidth: 0,
        bgcolor: 'var(--paper)',
        border: `1px solid ${selected ? INK : 'var(--rule)'}`,
        cursor: 'pointer',
        '&:hover': { borderColor: INK },
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: aspect, bgcolor: 'var(--ground)', overflow: 'hidden' }}>
        {/* 画布框常驻：出不了片时在上面盖一层说明，不能把节点摘掉（摘掉就再也不会重出片） */}
        <Box
          ref={holderRef}
          sx={{ position: 'absolute', inset: 0, '& canvas': { display: 'block', width: '100%', height: '100%', objectFit: 'contain' } }}
        />
        {error ? (
          <Stack
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
              px: 1,
              bgcolor: 'var(--ground)',
              border: '1px dashed var(--rule-strong)',
            }}
          >
            <Typography sx={{ fontSize: 10.5, textAlign: 'center' }}>第 {row.index} 行出不了片</Typography>
            <Typography sx={{ fontSize: 10, fontFamily: MONO_FONT, color: 'text.secondary', textAlign: 'center', lineHeight: 1.35 }}>
              {error}
            </Typography>
          </Stack>
        ) : !visible ? (
          <Stack sx={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>第 {row.index} 行待渲染</Typography>
          </Stack>
        ) : null}
      </Box>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 0.5, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 10.5,
            fontFamily: MONO_FONT,
            fontWeight: selected ? 700 : 400,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
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
  store,
  baseConfig,
  selectedConfig,
  selectedLayout,
  selectedSignature,
}: {
  store: LabelStore;
  /** 网格里每一行都基于它改标题/内容 */
  baseConfig: LabelConfig;
  /** 单张预览用当前选中行的配置（与单张制作模式同一路径） */
  selectedConfig: LabelConfig;
  selectedLayout: LabelLayout;
  selectedSignature: string;
}) {
  const { rows, selectedRow, previewLayout, previewZoom, previewColumns } = store;
  const fingerprint = useMemo(() => JSON.stringify(baseConfig), [baseConfig]);
  // 每格的媒体框比例只跟纸张有关：算一次，别让两百格各自再算一遍版式
  const tileAspect = useMemo(() => {
    const layout = layoutLabel(baseConfig);
    return `${layout.sheetWidthMm} / ${layout.sheetHeightMm}`;
  }, [baseConfig]);
  const shown = rows.slice(0, PREVIEW_CAP);
  const selectedExists = rows.some((row) => row.index === selectedRow);

  // 网格滚动位置：存 ref（跨排布切换存活），返回网格时恢复
  const scrollMemory = useRef(0);
  const [rangeBucket, setRangeBucket] = useState(0);
  const attachScroller = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    node.scrollTop = scrollMemory.current;
  }, []);

  const openSingle = useCallback(
    (index: number) => {
      store.setSelectedRow(index);
      store.setPreviewLayout('single');
    },
    [store],
  );

  const step = useCallback(
    (delta: number) => {
      if (!rows.length) return;
      const position = Math.max(0, rows.findIndex((row) => row.index === selectedRow));
      const next = rows[Math.min(rows.length - 1, Math.max(0, position + delta))];
      if (next) store.setSelectedRow(next.index);
    },
    [rows, selectedRow, store],
  );

  const firstVisible = rows.length ? Math.min(rows.length, rangeBucket * 3 + 1) : 0;
  const lastVisible = rows.length ? Math.min(rows.length, firstVisible + 5) : 0;

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
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>预览</Typography>
          <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {rows.length ? `${rows.length} 张` : '无数据'}
          </Typography>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', whiteSpace: 'nowrap', display: { xs: 'none', md: 'block' } }}>
            双击缩略图看单张
          </Typography>
        </Stack>

        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {previewLayout === 'single' && selectedExists ? (
            <>
              <Typography
                sx={{ fontSize: 10.5, color: 'text.secondary', whiteSpace: 'nowrap', display: { xs: 'none', md: 'block' } }}
              >
                滚轮切换上下张
              </Typography>
              <Button size="small" variant="text" onClick={() => step(-1)} sx={{ minHeight: 22 }}>
                ‹ 上一张
              </Button>
              <Button size="small" variant="text" onClick={() => step(1)} sx={{ minHeight: 22 }}>
                下一张 ›
              </Button>
            </>
          ) : (
            <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>列数</Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={previewColumns}
                aria-label="预览网格列数"
                onChange={(_event, next: typeof previewColumns | null) => {
                  if (next !== null) store.setPreviewColumns(next);
                }}
              >
                {(['auto', 2, 3, 4, 5] as const).map((option) => (
                  <ToggleButton key={String(option)} value={option} sx={{ px: 1, py: 0.25, fontSize: 10.5 }}>
                    {option === 'auto' ? '自动' : option}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                第 {firstVisible}–{lastVisible} 张 / 共 {rows.length}
              </Typography>
            </Stack>
          )}

          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>排布</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={previewLayout}
              aria-label="预览排布"
              onChange={(_event, next: typeof previewLayout | null) => {
                if (next !== null) store.setPreviewLayout(next);
              }}
            >
              <ToggleButton value="single" sx={{ px: 1, py: 0.25, fontSize: 10.5 }}>
                单张突出
              </ToggleButton>
              <ToggleButton value="grid" sx={{ px: 1, py: 0.25, fontSize: 10.5 }}>
                多张网格
              </ToggleButton>
            </ToggleButtonGroup>
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
      ) : previewLayout === 'single' && selectedExists ? (
        // 与单张制作模式完全同源：同一个 PressSheet（缩放、读数条、刻度尺、套准十字）
        <PressSheet
          config={selectedConfig}
          layout={selectedLayout}
          signature={selectedSignature}
          zoom={previewZoom}
          onZoomChange={store.setPreviewZoom}
          onStep={step}
        />
      ) : (
        <Box
          ref={attachScroller}
          onScroll={(event) => {
            const top = event.currentTarget.scrollTop;
            scrollMemory.current = top;
            const bucket = Math.floor(top / TILE_STRIDE_PX);
            setRangeBucket((prev) => (prev === bucket ? prev : bucket));
          }}
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
              // 自动：按可用宽度铺；固定列数：每列 1fr（minmax(0) 防内容撑破）
              gridTemplateColumns:
                previewColumns === 'auto' ? 'repeat(auto-fill, minmax(148px, 1fr))' : `repeat(${previewColumns}, minmax(0, 1fr))`,
              gap: 1,
              alignContent: 'start',
            }}
          >
            {shown.map((row) => (
              <Tile
                key={row.index}
                row={row}
                config={baseConfig}
                aspect={tileAspect}
                fingerprint={fingerprint}
                selected={row.index === selectedRow}
                onSelect={store.setSelectedRow}
                onOpen={openSingle}
              />
            ))}
          </Box>
        </Box>
      )}
    </Stack>
  );
}