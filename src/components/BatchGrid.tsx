/**
 * 批量数据表：一行一条数据，出码就是一页一张标签。
 *
 * 表头钉住当前可见范围（第 X–Y 条 / 共 N 条），随滚动重算——
 * 这个读数是可视化层的真实值（来自 DataGrid 的渲染上下文），不是估算。
 */
import { useCallback, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { DataGrid, type GridColDef, type GridState } from '@mui/x-data-grid';
import { zhCN } from '@mui/x-data-grid/locales';
import type { BatchRow } from '../lib/types';
import { INK, MONO_FONT } from '../theme';

interface RowSpan {
  first: number;
  last: number;
}

const FIRST_ROW_SPAN: RowSpan = { first: 0, last: 0 };

/**
 * 读当前可见行范围。DataGrid 把渲染上下文挂在 virtualizer 的状态上，
 * 类型来自 @mui/x-virtualizer 的映射类型；这里按运行时形状校验后取值，
 * 库内部换形状时只会退回全量范围，不会崩。
 */
function readVisibleSpan(state: GridState): RowSpan {
  const virtual = state.virtualization as unknown as { renderContext?: unknown };
  const context = virtual?.renderContext;
  if (!context || typeof context !== 'object') return FIRST_ROW_SPAN;
  const firstRowIndex = 'firstRowIndex' in context ? context.firstRowIndex : undefined;
  const lastRowIndex = 'lastRowIndex' in context ? context.lastRowIndex : undefined;
  if (typeof firstRowIndex !== 'number' || typeof lastRowIndex !== 'number') return FIRST_ROW_SPAN;
  return { first: firstRowIndex, last: lastRowIndex };
}

function EmptyOverlay() {
  return (
    <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', gap: 0.5 }}>
      <Typography sx={{ fontSize: 12.5 }}>还没有数据</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>在左侧导入 CSV，或先下载示例文件看看格式</Typography>
    </Stack>
  );
}

export function BatchGrid({
  rows,
  selectedRow,
  onSelect,
}: {
  rows: BatchRow[];
  selectedRow: number;
  onSelect: (index: number) => void;
}) {
  const [span, setSpan] = useState<RowSpan>(FIRST_ROW_SPAN);

  // 行数不变就不重渲染：滚动时 onStateChange 每帧都会来
  const handleStateChange = useCallback((state: GridState) => {
    const next = readVisibleSpan(state);
    setSpan((prev) => (prev.first === next.first && prev.last === next.last ? prev : next));
  }, []);

  const columns = useMemo<GridColDef<BatchRow>[]>(
    () => [
      { field: 'index', headerName: '序号', width: 68, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'title', headerName: '标题', flex: 1, minWidth: 110 },
      { field: 'content', headerName: '内容', flex: 2, minWidth: 140 },
    ],
    [],
  );

  const total = rows.length;
  const first = total ? Math.min(span.first + 1, total) : 0;
  const last = total ? Math.max(first, Math.min(span.last + 1, total)) : 0;

  return (
    <Stack sx={{ minHeight: 0, flex: 1, bgcolor: 'var(--paper)' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.75,
          py: 0.75,
          bgcolor: 'rgba(16,16,16,0.035)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>数据</Typography>
        <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary' }}>
          第 {first}–{last} 条 / 共 {total} 条
        </Typography>
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid<BatchRow>
          aria-label="批量数据"
          rows={rows}
          columns={columns}
          getRowId={(row) => row.index}
          density="compact"
          disableColumnMenu
          disableColumnResize
          hideFooter
          onStateChange={handleStateChange}
          getRowClassName={(params) => (params.id === selectedRow ? 'row-current' : '')}
          onRowClick={(params) => onSelect(Number(params.id))}
          localeText={zhCN.components.MuiDataGrid.defaultProps.localeText}
          slots={{ noRowsOverlay: EmptyOverlay }}
          sx={{
            border: 'none',
            fontSize: 12,
            '--DataGrid-containerBackground': 'var(--paper)',
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: 'var(--paper)',
              borderBottom: `1.5px solid ${INK}`,
              fontSize: 11,
            },
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 700 },
            '& .MuiDataGrid-cell': { borderColor: 'var(--rule)', fontFamily: MONO_FONT, outline: 'none' },
            '& .MuiDataGrid-cell[data-field="title"], & .MuiDataGrid-cell[data-field="index"]': { fontFamily: 'inherit' },
            '& .MuiDataGrid-row:hover': { bgcolor: 'rgba(16,16,16,0.035)' },
            '& .MuiDataGrid-row.row-current': { outline: `1px solid ${INK}`, outlineOffset: -1, bgcolor: 'rgba(16,16,16,0.05)' },
            '& .MuiDataGrid-row.row-current .MuiDataGrid-cell': { fontWeight: 600 },
            '& .MuiDataGrid-filler, & .MuiDataGrid-scrollbarFiller': { bgcolor: 'transparent' },
            '& .MuiDataGrid-virtualScroller': { bgcolor: 'var(--paper)' },
          }}
        />
      </Box>
    </Stack>
  );
}
