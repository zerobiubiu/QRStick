/**
 * 批量数据源：CSV / TSV / TXT / JSON / XLSX 都能导入，也可以直接把 Excel 里复制的两列粘进来。
 *
 * 数据只存在这台机器上（改动自动保存）；解析层自动嗅探分隔符、识别 GBK，
 * 老式 .xls（二进制）明确拒绝并给出替代做法。
 */
import { useRef, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { DATA_FORMAT_LABEL, buildSampleCsv, parseDataFile, parsePastedText, type DataParse } from '../lib/importData';
import { saveBlob } from '../lib/download';
import type { LabelStore } from '../state/labelStore';
import { MONO_FONT } from '../theme';

export function BatchSource({ store }: { store: LabelStore }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const { batch, rows } = store;

  const apply = (parsed: DataParse, fileName: string) => {
    store.setRows(parsed.rows);
    store.setBatch({
      fileName,
      format: parsed.format,
      encoding: parsed.encoding,
      hasHeader: parsed.hasHeader,
      warnings: parsed.warnings,
    });
    store.setSelectedRow(parsed.rows[0]?.index ?? 1);
    setConfirmClear(false);
  };

  const load = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      apply(await parseDataFile(file), file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '文件解析失败');
    } finally {
      setBusy(false);
    }
  };

  const loadPaste = () => {
    setError('');
    try {
      apply(parsePastedText(pasteText), '粘贴的数据');
      setPasteOpen(false);
      setPasteText('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '粘贴内容解析失败');
    }
  };

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
            {busy ? '正在读…' : '导入数据'}
          </Button>
          <Button size="small" variant="outlined" onClick={() => setPasteOpen((open) => !open)}>
            {pasteOpen ? '收起粘贴' : '粘贴数据'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              saveBlob(new Blob([`\uFEFF${buildSampleCsv()}`], { type: 'text/csv;charset=utf-8' }), 'qrstick-示例数据.csv')
            }
          >
            下载示例 CSV
          </Button>
          {rows.length ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  return;
                }
                store.setRows([]);
                store.setBatch(null);
                setConfirmClear(false);
              }}
            >
              {confirmClear ? '再点一次清空' : '清空数据'}
            </Button>
          ) : null}
        </Stack>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.json,.xlsx"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void load(file);
          }}
        />

        {pasteOpen ? (
          <Stack sx={{ gap: 0.75 }}>
            <TextField
              size="small"
              multiline
              minRows={3}
              maxRows={8}
              fullWidth
              value={pasteText}
              placeholder={'从 Excel 里选中两列复制，粘到这里（制表符分隔）'}
              onChange={(event) => setPasteText(event.target.value)}
              slotProps={{ htmlInput: { 'aria-label': '粘贴数据', style: { fontFamily: MONO_FONT, lineHeight: 1.5 } } }}
            />
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button size="small" variant="outlined" onClick={loadPaste}>
                导入粘贴内容
              </Button>
              <Button size="small" variant="text" onClick={() => setPasteText('')}>
                清空粘贴框
              </Button>
            </Stack>
          </Stack>
        ) : null}

        <Typography sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1.5 }}>
          CSV / TSV / TXT / JSON / XLSX 都能读；分隔符自动嗅探，Excel 另存的 GBK 自动识别。老式 .xls 请先另存为 xlsx
          或 csv。数据只存在这台机器上，改动自动保存；表格里可直接改标题与内容、增删行。
        </Typography>

        {batch ? (
          <Typography sx={{ fontSize: 10.5, fontFamily: MONO_FONT, color: 'text.secondary', lineHeight: 1.5 }}>
            {batch.fileName} · {DATA_FORMAT_LABEL[batch.format]} · {batch.encoding.toUpperCase()} ·{' '}
            {batch.hasHeader ? '有表头' : '无表头'}
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

        {error ? <Typography sx={{ fontSize: 10.5, color: 'text.primary' }}>· {error}</Typography> : null}
      </Stack>
    </Box>
  );
}