/**
 * 批量数据表：MUI Table + dnd-kit。
 *
 * 为什么不用 DataGrid：这一版要求「普通二维表」的编辑手感（行内改、加行删行、多选、
 * 行拖拽排序、列宽手动拖拽、容器伸缩），这些在 Table 上更直接，也少一层框架态同步。
 *
 * 三处工程约定：
 *  - 行的身份是 `row.index`（1 开始、连续），任何重排/删除都整体重排序号——它同时是预览的绑定键，
 *    所以拖拽后数据顺序与视觉顺序永远一致，不会出现「图片与数据错位」；
 *  - 行高固定（ROW_H），超过阈值只渲染视口内的行（上下用占位行撑高度），因此几千行也能流畅；
 *  - 列宽、分栏比例、多选、当前行都在 store 里，切换制作模式不会丢。
 */
import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BatchRow } from '../lib/types';
import type { LabelStore } from '../state/labelStore';
import { useElementSize } from '../lib/useElementSize';
import { INK, MONO_FONT } from '../theme';

/** 固定行高：窗口化渲染与拖拽测量都按它算 */
const ROW_H = 44;
/** 视口上下各多渲染几行，滚动时不留白 */
const OVERSCAN = 6;
/** 超过这个行数才启用窗口化，小批量时整表渲染更简单 */
const WINDOW_THRESHOLD = 60;
/** 列最小宽度：拖拽到此为止，避免把列拖没 */
const MIN_WIDTH: Record<string, number> = { index: 52, title: 96, content: 120 };
const RESIZABLE = ['index', 'title', 'content'];

const HEAD_CELL: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: '6px 8px',
  borderBottom: `1.5px solid ${INK}`,
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

function cellInputStyle(mono: boolean): CSSProperties {
  return {
    width: '100%',
    border: 'none',
    background: 'transparent',
    font: 'inherit',
    fontFamily: mono ? MONO_FONT : 'inherit',
    color: INK,
    padding: '6px 4px',
    borderRadius: 0,
    textOverflow: 'ellipsis',
  };
}

interface RowProps {
  row: BatchRow;
  checked: boolean;
  current: boolean;
  onToggle: (index: number) => void;
  onSelect: (index: number) => void;
  onEdit: (index: number, patch: Partial<Pick<BatchRow, 'title' | 'content'>>) => void;
  onRequestDelete: (index: number) => void;
}

function SortableRow({ row, checked, current, onToggle, onSelect, onEdit, onRequestDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.index });
  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    background: current ? 'rgba(16,16,16,0.05)' : undefined,
    height: ROW_H,
    // 选中行：描边表达，不用彩色底
    outline: current ? `1px solid ${INK}` : undefined,
    outlineOffset: -1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} hover data-row-index={row.index} onFocus={() => onSelect(row.index)}>
      <TableCell sx={{ width: 40, padding: '0 2px', borderBottom: '1px solid var(--rule)' }}>
        <Tooltip title="拖动排序" placement="right">
          <IconButton
            size="small"
            aria-label={`拖动第 ${row.index} 行`}
            {...attributes}
            {...listeners}
            sx={{ cursor: 'grab', color: 'text.secondary', '&:active': { cursor: 'grabbing' } }}
          >
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
      <TableCell padding="checkbox" sx={{ width: 40, borderBottom: '1px solid var(--rule)' }}>
        <Checkbox
          size="small"
          checked={checked}
          onChange={() => onToggle(row.index)}
          slotProps={{ input: { 'aria-label': `选择第 ${row.index} 行` } }}
        />
      </TableCell>
      <TableCell sx={{ fontFamily: MONO_FONT, fontSize: 12, padding: '0 8px', borderBottom: '1px solid var(--rule)' }}>
        {row.index}
      </TableCell>
      <TableCell sx={{ padding: 0, borderBottom: '1px solid var(--rule)' }}>
        <input
          value={row.title}
          aria-label={`第 ${row.index} 行标题`}
          onChange={(event) => onEdit(row.index, { title: event.target.value })}
          onFocus={() => onSelect(row.index)}
          style={cellInputStyle(false)}
        />
      </TableCell>
      <TableCell sx={{ padding: 0, borderBottom: '1px solid var(--rule)' }}>
        <input
          value={row.content}
          aria-label={`第 ${row.index} 行内容`}
          onChange={(event) => onEdit(row.index, { content: event.target.value })}
          onFocus={() => onSelect(row.index)}
          style={cellInputStyle(true)}
        />
      </TableCell>
      <TableCell sx={{ width: 44, padding: '0 2px', borderBottom: '1px solid var(--rule)' }}>
        <Tooltip title={`删除第 ${row.index} 行`} placement="left">
          <IconButton
            size="small"
            aria-label={`删除第 ${row.index} 行`}
            onClick={() => onRequestDelete(row.index)}
            sx={{ color: 'text.secondary', '&:hover': { color: INK } }}
          >
            <DeleteOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

export function BatchTable({ store, onRequestDelete }: { store: LabelStore; onRequestDelete: (indexes: number[]) => void }) {
  const { rows, selectedIds, selectedRow, columnWidths } = store;
  const [scrollTop, setScrollTop] = useState(0);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const { size: viewport, attach: attachViewport } = useElementSize();
  const widthsRef = useRef(columnWidths);
  widthsRef.current = columnWidths;

  const sensors = useSensors(
    // 距离阈值：点复选框、点输入框不会误触发拖拽
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const windowed = rows.length > WINDOW_THRESHOLD;
  const viewportHeight = viewport.height || ROW_H * 12;
  const start = windowed ? Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN) : 0;
  const end = windowed ? Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / ROW_H) + OVERSCAN) : rows.length;
  const visible = useMemo(() => rows.slice(start, end), [rows, start, end]);
  const visibleIds = useMemo(() => visible.map((row) => row.index), [visible]);

  const allChecked = rows.length > 0 && selectedIds.length === rows.length;
  const someChecked = selectedIds.length > 0 && !allChecked;
  const firstVisible = rows.length ? start + 1 : 0;
  const lastVisible = rows.length ? end : 0;

  const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(Number(event.active.id)), []);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = rows.findIndex((row) => row.index === Number(active.id));
      const to = rows.findIndex((row) => row.index === Number(over.id));
      if (from < 0 || to < 0) return;
      store.moveRow(from, to);
    },
    [rows, store],
  );

  const startResize = (field: string) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widthsRef.current[field] ?? 120;
    const min = MIN_WIDTH[field] ?? 60;
    setResizing(field);
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.max(min, Math.round(startWidth + (moveEvent.clientX - startX)));
      store.setColumnWidths({ ...widthsRef.current, [field]: next });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      setResizing(null);
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const totalWidth = ['handle', 'select', ...RESIZABLE, 'actions'].reduce(
    (sum, field) => sum + (columnWidths[field] ?? MIN_WIDTH[field] ?? 90),
    0,
  );

  const activeRow = activeId === null ? null : rows.find((row) => row.index === activeId) ?? null;

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
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>数据</Typography>
          <Button size="small" variant="text" onClick={store.addRow} sx={{ minHeight: 22, color: 'text.secondary' }}>
            ＋ 新增一行
          </Button>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            拖动左侧手柄排序 · 表头右缘拖拽改列宽
          </Typography>
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
          {selectedIds.length ? (
            <>
              <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                已选 {selectedIds.length} 行
              </Typography>
              <Button size="small" variant="outlined" onClick={() => onRequestDelete(selectedIds)}>
                删除选中
              </Button>
              <Button size="small" variant="text" onClick={() => store.setSelectedIds([])}>
                取消选择
              </Button>
            </>
          ) : null}
          <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            第 {firstVisible}–{lastVisible} 条 / 共 {rows.length} 条
          </Typography>
        </Stack>
      </Stack>

      {rows.length === 0 ? (
        <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0.5, py: 3 }}>
          <Typography sx={{ fontSize: 12.5 }}>还没有数据</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>
            在上方「批量数据源」里导入 CSV / Excel / 粘贴数据，或点「＋ 新增一行」手填
          </Typography>
        </Stack>
      ) : (
        <Box
          ref={attachViewport}
          onScroll={(event) => setScrollTop((event.target as HTMLElement).scrollTop)}
          sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
              <Table
                size="small"
                sx={{
                  tableLayout: 'fixed',
                  width: totalWidth,
                  minWidth: '100%',
                  borderCollapse: 'separate',
                  '& td, & th': { borderColor: 'var(--rule)' },
                }}
              >
                <colgroup>
                  <col style={{ width: columnWidths.handle }} />
                  <col style={{ width: columnWidths.select }} />
                  <col style={{ width: columnWidths.index }} />
                  <col style={{ width: columnWidths.title }} />
                  <col style={{ width: columnWidths.content }} />
                  <col style={{ width: columnWidths.actions }} />
                </colgroup>
                <TableHead sx={{ position: 'sticky', top: 0, zIndex: 3, bgcolor: 'var(--paper)' }}>
                  <TableRow>
                    <TableCell sx={{ ...HEAD_CELL, padding: 0 }} />
                    <TableCell padding="checkbox" sx={{ ...HEAD_CELL, padding: 0 }}>
                      <Checkbox
                        size="small"
                        checked={allChecked}
                        indeterminate={someChecked}
                        onChange={() => (allChecked ? store.setSelectedIds([]) : store.setSelectedIds(rows.map((row) => row.index)))}
                        slotProps={{ input: { 'aria-label': '全选数据行' } }}
                      />
                    </TableCell>
                    {(['index', 'title', 'content'] as const).map((field) => (
                      <TableCell key={field} sx={{ ...HEAD_CELL, position: 'relative' }}>
                        <TableSortLabel hideSortIcon disabled sx={{ cursor: 'default', '& svg': { display: 'none' } }}>
                          {field === 'index' ? '序号' : field === 'title' ? '标题' : '内容'}
                        </TableSortLabel>
                        <Box
                          role="separator"
                          aria-label={`调整${field === 'index' ? '序号' : field === 'title' ? '标题' : '内容'}列宽`}
                          onPointerDown={startResize(field)}
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: -4,
                            width: 9,
                            height: '100%',
                            // 高于相邻表头：分隔条压在邻居的盒子上，没有 z-index 时真鼠标点不到它
                            zIndex: 6,
                            cursor: 'col-resize',
                            bgcolor: resizing === field ? 'var(--cyan)' : 'transparent',
                            '&:hover': { bgcolor: 'rgba(0,147,208,0.35)' },
                          }}
                        />
                      </TableCell>
                    ))}
                    <TableCell sx={{ ...HEAD_CELL, padding: 0 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {windowed && start > 0 ? (
                    <TableRow aria-hidden>
                      <TableCell colSpan={6} sx={{ height: start * ROW_H, padding: 0, border: 0 }} />
                    </TableRow>
                  ) : null}
                  {visible.map((row) => (
                    <SortableRow
                      key={row.index}
                      row={row}
                      checked={selectedIds.includes(row.index)}
                      current={row.index === selectedRow}
                      onToggle={store.toggleSelected}
                      onSelect={store.setSelectedRow}
                      onEdit={store.updateRow}
                      onRequestDelete={(index) => onRequestDelete([index])}
                    />
                  ))}
                  {windowed && end < rows.length ? (
                    <TableRow aria-hidden>
                      <TableCell colSpan={6} sx={{ height: (rows.length - end) * ROW_H, padding: 0, border: 0 }} />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </SortableContext>
            <DragOverlay adjustScale={false}>
              {activeRow ? (
                <Table size="small" sx={{ tableLayout: 'fixed', width: 320, bgcolor: 'var(--paper)', boxShadow: '0 6px 18px rgba(16,16,16,0.18)' }}>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontFamily: MONO_FONT, fontSize: 12, borderBottom: '1px solid var(--rule)' }}>
                        {activeRow.index}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, borderBottom: '1px solid var(--rule)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {activeRow.title || '（无标题）'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : null}
            </DragOverlay>
          </DndContext>
        </Box>
      )}
    </Stack>
  );
}