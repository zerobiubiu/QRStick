/**
 * 批量数据源：CSV 一行一条，第一列标题、第二列内容。
 *
 * 现场用 Excel 存出来的 CSV 在中文 Windows 上是 GBK，解析层会自动识别编码；
 * 下载示例会带 UTF-8 BOM，保证 Excel 双击打开不乱码。
 */
import { useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { buildSampleCsv, parseCsvFile } from '../lib/csv';
import { saveBlob } from '../lib/download';
import type { LabelStore } from '../state/labelStore';
import { MONO_FONT } from '../theme';

export function BatchSource({ store }: { store: LabelStore }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      const parsed = await parseCsvFile(file);
      store.setRows(parsed.rows);
      store.setBatch({
        fileName: file.name,
        encoding: parsed.encoding,
        hasHeader: parsed.hasHeader,
        warnings: parsed.warnings,
      });
      store.setSelectedRow(parsed.rows[0]?.index ?? 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'CSV 解析失败');
      store.setRows([]);
      store.setBatch(null);
    } finally {
      setBusy(false);
    }
  };

  const { batch, rows } = store;

  return (
    <Box component="section">
      <Stack
        direction="row"
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          px: 2,
          py: 0.75,
          bgcolor: 'rgba(16,16,16,0.035)',
          borderTop: '1px solid var(--rule)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>批量数据源</Typography>
        <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary' }}>
          {rows.length ? `${rows.length} 条` : '未导入'}
        </Typography>
      </Stack>

      <Stack sx={{ px: 2, py: 1.25, gap: 1 }}>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? '正在读…' : '导入 CSV'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => saveBlob(new Blob([`\uFEFF${buildSampleCsv()}`], { type: 'text/csv;charset=utf-8' }), 'qrstick-示例数据.csv')}
          >
            下载示例
          </Button>
          {rows.length ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                store.setRows([]);
                store.setBatch(null);
              }}
            >
              清空数据
            </Button>
          ) : null}
        </Stack>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void load(file);
          }}
        />

        <Typography sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1.5 }}>
          第一列标题、第二列内容（有表头就更准）。Excel 存的 GBK 编码也能直接读，数据不出这台机器。
        </Typography>

        {batch ? (
          <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', lineHeight: 1.5 }}>
            {batch.fileName} · {batch.encoding.toUpperCase()} · {batch.hasHeader ? '有表头' : '无表头'}
            {batch.warnings.length ? ` · ${batch.warnings.length} 条提醒` : ''}
          </Typography>
        ) : null}

        {batch?.warnings.length ? (
          <Box sx={{ borderLeft: '1px dashed var(--rule-strong)', pl: 1 }}>
            {batch.warnings.slice(0, 4).map((warning, index) => (
              <Typography key={index} sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1.5 }}>
                {warning}
              </Typography>
            ))}
            {batch.warnings.length > 4 ? (
              <Typography sx={{ fontSize: 10.5, color: 'text.disabled' }}>还有 {batch.warnings.length - 4} 条…</Typography>
            ) : null}
          </Box>
        ) : null}

        {error ? <Typography sx={{ fontSize: 10.5, color: 'error.main' }}>{error}</Typography> : null}
      </Stack>
    </Box>
  );
}
