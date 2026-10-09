/**
 * 批量数据表：一行一条数据，出码就是一页一张标签。
 *
 * 表本身是可编辑的（普通二维表：双击改标题/内容、末尾加行、按行删除），
 * 表头钉住当前可见范围（第 X–Y 条 / 共 N 条），随滚动重算——这个读数是可视化层的真实值。
 */
import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { DataGrid, type GridColDef, type GridState } from '@mui/x-data-grid';
import { zhCN } from '@mui/x-data-grid/locales';
import type { BatchRow } from '../lib/types';
import { INK, MONO_FONT } from '../theme';

interface RowSpan {
  first: number;
  last: number;
}

/** 未知跨度：宁可只说「共 N 条」，也不报一个具体的、错的区间 */
function readVisibleSpan(state: GridState): RowSpan | null {
  const virtual = state.virtualization as unknown as { renderContext?: unknown };
  const context = virtual?.renderContext;
  if (!context || typeof context !== 'object') return null;
  const firstRowIndex = 'firstRowIndex' in context ? context.firstRowIndex : undefined;
  const lastRowIndex = 'lastRowIndex' in context ? context.lastRowIndex : undefined;
  if (typeof firstRowIndex !== 'number' || typeof lastRowIndex !== 'number') return null;
  return { first: firstRowIndex, last: lastRowIndex };
}

function EmptyOverlay() {
  return (
    <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', gap: 0.5 }}>
      <Typography sx={{ fontSize: 12.5 }}>还没有数据</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>
        在上方「批量数据源」里导入 CSV / Excel / 粘贴数据，或先下载示例
      </Typography>
    </Stack>
  );
}

export function BatchGrid({
  rows,
  selectedRow,
  onSelect,
  onAddRow,
  onEditRow,
  onRemoveRow,
}: {
  rows: BatchRow[];
  selectedRow: number;
  onSelect: (index: number) => void;
  onAddRow: () => void;
  onEditRow: (index: number, patch: Partial<Pick<BatchRow, 'title' | 'content'>>) => void;
  onRemoveRow: (index: number) => void;
}) {
  const [span, setSpan] = useState<RowSpan | null>(null);

  // 行数不变就不重渲染：滚动时 onStateChange 每帧都会来
  const handleStateChange = useCallback((state: GridState) => {
    const next = readVisibleSpan(state);
    setSpan((prev) => (prev && next && prev.first === next.first && prev.last === next.last ? prev : next));
  }, []);

  const columns = useMemo<GridColDef<BatchRow>[]>(
    () => [
      { field: 'index', headerName: '序号', width: 62, type: 'number', align: 'right', headerAlign: 'right' },
      { field: 'title', headerName: '标题', flex: 1, minWidth: 104, editable: true },
      { field: 'content', headerName: '内容', flex: 2, minWidth: 132, editable: true },
      {
        field: 'rowAction',
        headerName: '',
        width: 46,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => (
          <Button
            size="small"
            variant="text"
            aria-label={`删除第 ${params.id} 行`}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveRow(Number(params.id));
            }}
          >
            删
          </Button>
        ),
      },
    ],
    [onRemoveRow],
  );

  const total = rows.length;
  const first = span && total ? Math.min(span.first + 1, total) : 0;
  const last = span && total ? Math.max(first, Math.min(span.last + 1, total)) : 0;
  const guideWords = span && total ? `第 ${first}–${last} 条 / 共 ${total} 条` : `共 ${total} 条`;

  return (
    <Stack sx={{ minHeight: 0, flex: 1, bgcolor: 'var(--paper)' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.75,
          py: 0.6,
          bgcolor: 'rgba(16,16,16,0.035)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'baseline', gap: 1.25, minWidth: 0 }}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>数据</Typography>
          <Button size="small" variant="text" onClick={onAddRow} sx={{ minHeight: 22, color: 'text.secondary' }}>
            ＋ 新增一行
          </Button>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>
            双击单元格改标题／内容
          </Typography>
        </Stack>
        <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {guideWords}
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
          processRowUpdate={(updated, previous) => {
            if (updated.title !== previous.title) onEditRow(previous.index, { title: updated.title });
            if (updated.content !== previous.content) onEditRow(previous.index, { content: updated.content });
            return updated;
          }}
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
            '& .MuiDataGrid-cell[data-field="title"], & .MuiDataGrid-cell[data-field="index"], & .MuiDataGrid-cell[data-field="rowAction"]':
              { fontFamily: 'inherit' },
            '& .MuiDataGrid-cell--editable': { cursor: 'text' },
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