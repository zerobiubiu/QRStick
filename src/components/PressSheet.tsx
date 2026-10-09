/**
 * 印张：预览就是出片的样子。
 *
 * 三层结构，从外到内：
 *  台面（灰底 + 四角套准十字）→ 毫米刻度尺（贴着印张的真实刻度）→ 纸（渲染核产出的画布）。
 * 刻度尺的刻度不是装饰：它按印张在当前屏幕上每毫米多少像素现算，读数就是真实尺寸。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { renderLabel, type LabelLayout } from '../lib/render';
import { formatMm } from '../lib/units';
import type { LabelConfig } from '../lib/types';
import { INK, MONO_FONT } from '../theme';

/** 预览画布的最长边；超过就等比降采样，导出永远用满 DPI */
const STAGE_MAX_PX = 1800;
const STRIP_PX = 22;

/** 套准十字：四个色版各出一根，印张世界的签名细节 */
function RegistrationMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 17 17" aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="8.5" cy="8.5" r="4" fill="none" stroke="rgba(16,16,16,0.55)" strokeWidth="0.7" />
      <path d="M8.5 0.5V16.5M0.5 8.5H16.5" stroke="rgba(16,16,16,0.55)" strokeWidth="0.7" />
      <path d="M8.5 0.5V3" stroke="#0093d0" strokeWidth="1.2" />
      <path d="M8.5 14V16.5" stroke="#e5007d" strokeWidth="1.2" />
      <path d="M0.5 8.5H3" stroke="#ffe200" strokeWidth="1.2" />
      <path d="M14 8.5H16.5" stroke={INK} strokeWidth="1.2" />
    </svg>
  );
}

/**
 * 量台面的尺寸：节点挂载（含布局变化后重新挂载）时同步量一次，
 * ResizeObserver 负责后续变化。0 尺寸一律忽略——切标签页、整页截图这类
 * 瞬时的 0 高度不该把印张从界面上抹掉。
 */
function useMeasuredBox() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!node) return;
    // 量内容框：clientWidth 含内边距，而印张只摆在内容框里——
    // 多量进 44px 内边距，纸面就会溢出到台面外被裁掉（毫米尺整条被切）
    const measure = () => {
      const style = getComputedStyle(node);
      const width = node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = node.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width > 0 && height > 0) setBox({ width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // 兜底：ResizeObserver 在隐身/无头环境里可能不投递回调，窗口尺寸变化必须照样量
    window.addEventListener('resize', measure);
    const frame = requestAnimationFrame(measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      cancelAnimationFrame(frame);
    };
  }, [node]);

  return { box, attach: setNode };
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

function SheetRuler({ axis, lengthPx, pxPerMm }: { axis: 'x' | 'y'; lengthPx: number; pxPerMm: number }) {
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
              <text x={tick.position + 2.5} y={8} fontSize="9" fontFamily={MONO_FONT} fill="rgba(16,16,16,0.6)">
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
              fontSize="9"
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
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ px: 1.5, py: 0.75, borderLeft: '1px solid var(--rule)', minWidth: 0, flex: '0 0 auto' }}>
      <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.2 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11, fontFamily: MONO_FONT, lineHeight: 1.45, whiteSpace: 'nowrap' }}>{value}</Typography>
    </Box>
  );
}

export function PressSheet({ config, layout, signature }: { config: LabelConfig; layout: LabelLayout; signature: string }) {
  const { box: stage, attach: attachStage } = useMeasuredBox();

  const rendered = useMemo(() => {
    const scale = Math.min(1, STAGE_MAX_PX / Math.max(layout.pixelWidth, layout.pixelHeight));
    return renderLabel(config, scale);
  }, [config, layout.pixelWidth, layout.pixelHeight]);

  // 用回调 ref 挂画布：hold 住节点的可以是首次测量之前（台面还没量到尺寸），
  // 用 effect 会因为「节点晚于 effect 出现」而漏挂。
  const attachCanvas = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const canvas = rendered.canvas;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      node.replaceChildren(canvas);
    },
    [rendered],
  );

  const pxPerMm = Math.min(
    4,
    Math.max(
      0,
      Math.min(
        (stage.width - STRIP_PX - 4) / Math.max(1, layout.sheetWidthMm),
        (stage.height - STRIP_PX - 4) / Math.max(1, layout.sheetHeightMm),
      ),
    ),
  );
  const displayWidth = layout.sheetWidthMm * pxPerMm;
  const displayHeight = layout.sheetHeightMm * pxPerMm;
  const qrReadout =
    layout.qrModules > 0
      ? `${layout.qrActualMm.toFixed(1)} mm · ${layout.qrModulePx} px/模块 · ${layout.qrModules} 模块`
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
          placeContent: 'center',
          p: `${STRIP_PX}px`,
          overflow: 'hidden',
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

        {pxPerMm > 0.4 ? (
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
                bgcolor: '#fff',
                position: 'relative',
                boxShadow: '0 1px 1.5px rgba(16,16,16,0.16), 0 18px 34px -18px rgba(16,16,16,0.34)',
              }}
            >
              <Box ref={attachCanvas} key={signature} className="sheet-ink" sx={{ position: 'absolute', inset: 0 }} />
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
        <Readout label="标题" value={`${layout.titleLines.length} 行 · ${config.title.fontSizePt} pt`} />
        <Readout label="版心" value={`${formatMm(layout.contentWidthPx / (layout.dpi / 25.4))} × ${formatMm(layout.contentHeightPx / (layout.dpi / 25.4))} mm`} />
        <Readout label="内容" value={`${config.content.length} 字符`} />
      </Stack>
    </Box>
  );
}
