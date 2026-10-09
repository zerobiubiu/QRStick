/**
 * 印张：预览就是出片的样子。
 *
 * 三层结构，从外到内：
 *  台面（灰底 + 四角套准十字）→ 毫米刻度尺（贴着印张的真实刻度）→ 纸（渲染核产出的画布）。
 * 刻度尺的刻度不是装饰：它按印张在当前屏幕上每毫米多少像素现算，读数就是真实尺寸。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { renderLabel, type LabelLayout } from '../lib/render';
import { LineMark } from './StateLine';
import { PREVIEW_MAX_PX, previewScaleFor } from '../lib/preview';
import { useElementSize } from '../lib/useElementSize';
import { MM_PER_INCH, formatMm } from '../lib/units';
import type { LabelConfig } from '../lib/types';
import { CYAN, INK, MAGENTA, MONO_FONT, FONT_PX, YELLOW } from '../theme';

/** 刻度尺条的高度（像素） */
const STRIP_PX = 22;
/** 可选的缩放倍数：1 = 适应窗口 */
const ZOOM_STEPS = [1, 1.5, 2, 3];
/** 滚轮累计多少像素才算「切一张」：触控板一格只有几像素，不累计会一次飞过头 */
const WHEEL_STEP_PX = 40;

/** 套准十字：四个色版各出一根，印张世界的签名细节 */
function RegistrationMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 17 17" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="8.5" cy="8.5" r="4" fill="none" stroke="rgba(16,16,16,0.55)" strokeWidth="0.7" />
      <path d="M8.5 0.5V16.5M0.5 8.5H16.5" stroke="rgba(16,16,16,0.55)" strokeWidth="0.7" />
      <path d="M8.5 0.5V3" stroke={CYAN} strokeWidth="1.2" />
      <path d="M8.5 14V16.5" stroke={MAGENTA} strokeWidth="1.2" />
      <path d="M0.5 8.5H3" stroke={YELLOW} strokeWidth="1.2" />
      <path d="M14 8.5H16.5" stroke={INK} strokeWidth="1.2" />
    </svg>
  );
}

/**
 * 量台面的尺寸：交给共用的 useElementSize（挂载即量 + ResizeObserver + resize/rAF 兜底）。
 */
function useMeasuredBox() {
  const { size, attach } = useElementSize();
  return { box: { width: size.width, height: size.height }, attach };
}

/** 按「当前每毫米多少像素」现算刻度：太密时自动降到 2 / 5 / 10 mm 一档 */
function buildTicks(lengthPx: number, pxPerMm: number) {
  const step = pxPerMm >= 4 ? 1 : pxPerMm >= 2 ? 2 : pxPerMm >= 0.9 ? 5 : 10;
  const labelEvery = Math.max(1, Math.ceil(34 / (step * pxPerMm)));
  const ticks: { position: number; major: boolean; label?: string }[] = [];
  for (let mm = 0; mm * pxPerMm <= lengthPx + 0.5; mm += step) {
    const major = Math.round(mm / step) % labelEvery === 0;
    ticks.push({ position: mm * pxPerMm, major, label: major ? String(Math.round(mm)) : undefined });
  }
  return { ticks, step };
}

/**
 * 刻度尺：刻度数量随印张毫米数与屏幕密度增长（A4 纵向约 500 条线）。
 * 用 memo 挡住「参数改动导致的重渲」——刻度只取决于长度与密度，字号/内容改动不该重造这几百个元素。
 */
const SheetRuler = memo(function SheetRuler({ axis, lengthPx, pxPerMm }: { axis: 'x' | 'y'; lengthPx: number; pxPerMm: number }) {
  const { ticks } = useMemo(() => buildTicks(lengthPx, pxPerMm), [lengthPx, pxPerMm]);
  const length = Math.max(1, Math.ceil(lengthPx));

  if (axis === 'x') {
    return (
      <svg width={length} height={STRIP_PX} style={{ display: 'block' }} aria-hidden="true">
        {ticks.map((tick) => (
          <g key={tick.position}>
            <line
              x1={tick.position}
              y1={STRIP_PX}
              x2={tick.position}
              y2={STRIP_PX - (tick.major ? 9 : 4)}
              stroke={INK}
              strokeWidth={tick.major ? 1 : 0.7}
              opacity={tick.major ? 0.75 : 0.4}
            />
            {tick.label ? (
              <text x={tick.position + 2.5} y={8} fontSize={FONT_PX.ruler} fontFamily={MONO_FONT} fill="rgba(16,16,16,0.6)">
                {tick.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    );
  }

  return (
    <svg width={STRIP_PX} height={length} style={{ display: 'block' }} aria-hidden="true">
      {ticks.map((tick) => (
        <g key={tick.position}>
          <line
            x1={STRIP_PX}
            y1={tick.position}
            x2={STRIP_PX - (tick.major ? 9 : 4)}
            y2={tick.position}
            stroke={INK}
            strokeWidth={tick.major ? 1 : 0.7}
            opacity={tick.major ? 0.75 : 0.4}
          />
          {tick.label ? (
            <text
              x={1}
              y={tick.position - 3}
              fontSize={FONT_PX.ruler}
              fontFamily={MONO_FONT}
              fill="rgba(16,16,16,0.6)"
              transform={`rotate(-90 1 ${tick.position - 3})`}
            >
              {tick.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
});

const Readout = memo(function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ px: 1.5, py: 0.75, borderLeft: '1px solid var(--rule)', minWidth: 0, flex: '0 0 auto' }}>
      <Typography sx={{ fontSize: FONT_PX.micro, color: 'text.secondary', lineHeight: 1.2 }}>{label}</Typography>
      <Typography sx={{ fontSize: FONT_PX.readout, fontFamily: MONO_FONT, lineHeight: 1.45, whiteSpace: 'nowrap' }}>{value}</Typography>
    </Box>
  );
});

export function PressSheet({
  config,
  layout,
  signature,
  zoom,
  onZoomChange,
  onStep,
}: {
  config: LabelConfig;
  layout: LabelLayout;
  signature: string;
  /** 缩放倍数：1 = 适应窗口；>1 放大并在台面内滚动 */
  zoom: number;
  onZoomChange: (zoom: number) => void;
  /** 传了它才接管滚轮：台面滚不动时滚轮切上下张（放大到能滚时仍先滚纸面） */
  onStep?: (delta: number) => void;
}) {
  const { box: stage, attach: attachSize } = useMeasuredBox();
  const stageRef = useRef<HTMLDivElement | null>(null);
  // 台面节点既要量尺寸（回调 ref）又要挂非被动 wheel 监听，所以在这里串一层
  const attachStage = useCallback(
    (node: HTMLDivElement | null) => {
      stageRef.current = node;
      return attachSize(node);
    },
    [attachSize],
  );

  // 滚轮切上下张：React 的 onWheel 是被动监听（preventDefault 无效），这里挂原生非被动监听。
  // 只在台面滚不动时才接管——放大态滚轮先用来滚纸面，否则放大等于白放。
  //
  // 累计量只用一个 ref：够一格（WHEEL_STEP_PX）就换一张并归零，不设空闲定时器——
  // 定时器在隐藏/无头标签页里会被钳到 ≥1s，行为随标签页是否可见而变，不如不做。
  // 监听器只挂一次、回调走 ref：onStep 的依赖里有 store（每次渲染都是新对象），
  // 把它放进 effect 依赖会让监听器反复重建、累计量被清空。
  const onStepRef = useRef(onStep);
  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);
  const wheelAccumulated = useRef(0);
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      const handler = onStepRef.current;
      if (!handler || event.deltaY === 0) return;
      // 台面自己能滚（放大态）时，滚轮先用来滚纸面
      if (node.scrollHeight > node.clientHeight + 2) return;
      wheelAccumulated.current += event.deltaY;
      if (Math.abs(wheelAccumulated.current) < WHEEL_STEP_PX) return;
      event.preventDefault();
      handler(wheelAccumulated.current > 0 ? 1 : -1);
      wheelAccumulated.current = 0;
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  // 预览画布：整块组件只创建一张（useState 惰性初始化，渲染期不碰 ref），参数改动只在它上面重绘
  const [previewCanvas] = useState(() => document.createElement('canvas'));
  const inkRef = useRef<HTMLDivElement | null>(null);

  // 适应窗口的基准比例：把印张按最长边放进台面
  const fitPxPerMm = Math.min(
    4,
    Math.max(
      0,
      Math.min(
        (stage.width - STRIP_PX - 4) / Math.max(1, layout.sheetWidthMm),
        (stage.height - STRIP_PX - 4) / Math.max(1, layout.sheetHeightMm),
      ),
    ),
  );
  // 缩放是相对「适应窗口」的倍数：放大后台面内滚动，绝不裁切、绝不拉伸（等比）
  const pxPerMm = fitPxPerMm > 0 ? Math.min(12, fitPxPerMm * zoom) : 0;
  const displayWidth = layout.sheetWidthMm * pxPerMm;
  const displayHeight = layout.sheetHeightMm * pxPerMm;

  const rendered = useMemo(() => {
    // 预览画布按台面上的**实际显示像素**渲染，再受 PREVIEW_MAX_PX 封顶：
    // 画得比显示大，浏览器每帧都要把整张位图二次缩放（实测 A4 参数连击每步卡 60–120ms，
    // 同操作在 60×40 贴纸上只有 11ms）。二维码模块尺寸仍然只在导出网格上决定（见 render.ts 的纪律），
    // 这里只是把同一张码位图等比缩放；画布常驻复用见 renderLabel 的 into 参数。
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    // 台面上每毫米的屏幕像素 → 等效 DPI（×25.4），再乘 DPR 保住高分屏清晰度
    const onScreen = pxPerMm > 0 ? (pxPerMm * MM_PER_INCH * dpr) / Math.max(1, layout.dpi) : 0;
    const cap = previewScaleFor(layout, PREVIEW_MAX_PX);
    const scale = onScreen > 0 ? Math.min(cap, onScreen) : cap;
    return renderLabel(config, scale, previewCanvas);
  }, [config, layout, previewCanvas, pxPerMm]);

  // 画布分配不出（尺寸超浏览器上限）：这一张预览不了，也绝不能挂一张空白画布冒充出片结果
  const canvasUnavailable = rendered.failure === 'canvas_unavailable';

  // 用回调 ref 挂画布：hold 住节点的可以是首次测量之前（台面还没量到尺寸），
  // 用 effect 会因为「节点晚于 effect 出现」而漏挂。
  const attachCanvas = useCallback(
    (node: HTMLDivElement | null) => {
      inkRef.current = node;
      if (!node) return;
      // 画布尺寸交给 CSS（'& canvas' 规则），回调里只负责挂载，避免在渲染期改外部对象的样式；
      // 已经是同一张画布就不要 replaceChildren——摘挂一次会让合成器重新上传整张位图
      if (node.firstChild !== rendered.canvas) node.replaceChildren(rendered.canvas);
    },
    [rendered],
  );

  // 上墨：每次重排把 180ms 动画从头放一遍。元素不再重挂（key 会让预览画布无法复用），改显式重放
  useEffect(() => {
    const node = inkRef.current;
    if (!node) return;
    node.style.animation = 'none';
    void node.offsetWidth; // 强制一次重排，动画才会真的从头开始
    node.style.animation = '';
  }, [signature]);

  const qrReadout =
    layout.qrModules > 0
      ? `外框 ${layout.qrActualMm.toFixed(1)} mm · 码面 ${layout.qrInkMm.toFixed(1)} mm · ${layout.qrModulePx} px/模块 · ${layout.qrModules} 模块`
      : layout.qrOverflow
        ? '占位（内容超出二维码容量）'
        : '占位（内容为空）';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, flex: 1, bgcolor: 'var(--ground)' }}>
      <Box
        ref={attachStage}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'grid',
          // 放大后从左上排起并允许滚动（看得全，而不是被裁掉）
          placeContent: zoom > 1 ? 'start' : 'center',
          p: `${STRIP_PX}px`,
          overflow: zoom > 1 ? 'auto' : 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', inset: 6, pointerEvents: 'none' }}>
          <Box sx={{ position: 'absolute', top: 0, left: 0 }}>
            <RegistrationMark />
          </Box>
          <Box sx={{ position: 'absolute', top: 0, right: 0 }}>
            <RegistrationMark />
          </Box>
          <Box sx={{ position: 'absolute', bottom: 0, left: 0 }}>
            <RegistrationMark />
          </Box>
          <Box sx={{ position: 'absolute', bottom: 0, right: 0 }}>
            <RegistrationMark />
          </Box>
        </Box>

        {canvasUnavailable ? (
          // 出不了图时说人话：台面上给一句原因与出路，而不是一张空白纸
          <Stack sx={{ maxWidth: 340, gap: 0.75 }}>
            <LineMark form="dashed" width={22} />
            <Typography sx={{ fontSize: FONT_PX.readout, fontFamily: MONO_FONT, color: 'text.secondary', lineHeight: 1.5 }}>
              画布太大，浏览器分配不出：降低 DPI、缩小纸张或减小页边距
            </Typography>
          </Stack>
        ) : pxPerMm > 0.4 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `${STRIP_PX}px auto`,
              gridTemplateRows: `${STRIP_PX}px auto`,
              // 兜底：任何量测误差都表现为整体缩小，绝不裁切
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <Box />
            <SheetRuler axis="x" lengthPx={displayWidth} pxPerMm={pxPerMm} />
            <SheetRuler axis="y" lengthPx={displayHeight} pxPerMm={pxPerMm} />
            <Box
              sx={{
                width: displayWidth,
                height: displayHeight,
                bgcolor: 'var(--paper)',
                position: 'relative',
                boxShadow: '0 1px 1.5px rgba(16,16,16,0.16), 0 18px 34px -18px rgba(16,16,16,0.34)',
              }}
            >
              <Box
                ref={attachCanvas}
                className="sheet-ink"
                role="img"
                aria-label={`印张预览：${layout.sheetWidthMm} × ${layout.sheetHeightMm} mm · ${layout.dpi} dpi · 二维码码面 ${layout.qrInkMm.toFixed(1)} mm`}
                sx={{ position: 'absolute', inset: 0, '& canvas': { display: 'block', width: '100%', height: '100%', objectFit: 'contain' } }}
              />
            </Box>
          </Box>
        ) : null}
      </Box>

      <Stack
        direction="row"
        sx={{
          // 窄屏把读数压成一行横滑：读数不能把印张挤掉（优先级塌缩）
          flexWrap: { xs: 'nowrap', md: 'wrap' },
          overflowX: { xs: 'auto', md: 'visible' },
          bgcolor: 'var(--paper)',
          borderTop: '1px solid var(--rule)',
          pl: 0.25,
        }}
      >
        <Readout
          label="印张"
          value={`${formatMm(layout.sheetWidthMm)} × ${formatMm(layout.sheetHeightMm)} mm · ${config.page.landscape ? '横向' : '纵向'}`}
        />
        <Readout label="分辨率" value={`${layout.dpi} dpi · ${layout.pixelWidth} × ${layout.pixelHeight} px`} />
        <Readout label="二维码" value={qrReadout} />
        {/* 纠错取实际等级：内容过长会回退，读数必须与印在纸上的那条色标条一致 */}
        <Readout
          label="纠错"
          value={
            layout.actualErrorCorrectionLevel === config.qr.errorCorrectionLevel
              ? layout.actualErrorCorrectionLevel
              : `${layout.actualErrorCorrectionLevel}（请求 ${config.qr.errorCorrectionLevel}）`
          }
        />
        <Readout label="标题" value={`${layout.titleLines.length} 行 · ${config.title.fontSizePt} pt`} />
        <Readout label="版心" value={`${formatMm(layout.contentWidthPx / (layout.dpi / 25.4))} × ${formatMm(layout.contentHeightPx / (layout.dpi / 25.4))} mm`} />
        <Readout label="内容" value={`${config.content.length} 字符`} />
        <Box
          sx={{
            ml: 'auto',
            px: 1.5,
            py: 0.6,
            borderLeft: '1px solid var(--rule)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: '0 0 auto',
          }}
        >
          <Typography sx={{ fontSize: FONT_PX.micro, color: 'text.secondary' }}>缩放</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={zoom}
            aria-label="预览缩放"
            onChange={(_event, next: number | null) => {
              if (next !== null) onZoomChange(next);
            }}
          >
            {ZOOM_STEPS.map((step) => (
              <ToggleButton key={step} value={step} sx={{ px: 1, py: 0.25, fontSize: FONT_PX.meta }}>
                {step === 1 ? '适应' : `×${step}`}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography sx={{ fontSize: FONT_PX.micro, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            {pxPerMm > 0 ? `${pxPerMm.toFixed(2)} px/mm` : '—'}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
