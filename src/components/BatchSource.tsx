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
import type { ConfirmRequest } from './ConfirmDialog';
import type { LabelStore } from '../state/labelStore';
import { MONO_FONT, FONT_PX } from '../theme';

export function BatchSource({ store, confirm }: { store: LabelStore; confirm: (request: ConfirmRequest) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [warningsOpen, setWarningsOpen] = useState(false);
  const { batch, rows, rowsStorageError } = store;

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
    store.setSelectedIds([]); // 换了一批数据，旧的多选不再指向任何一行
    setWarningsOpen(false); // 新的一批提醒默认折起来，别把长列表一次摊开
  };

  /**
   * 解析后的落库：0 行当错误、已有数据先确认。
   * 直接覆盖会静默盖掉现场数据；空文件若照单全收，会清空行并把文件名当成来源。
   */
  const commit = (parsed: DataParse, fileName: string, afterApply?: () => void) => {
    if (parsed.rows.length === 0) {
      setError(
        rows.length
          ? `「${fileName}」文件里没有可用的数据行：已保留原来的 ${rows.length} 行数据。`
          : `「${fileName}」文件里没有可用的数据行：没有导入任何数据。`,
      );
      return;
    }
    const done = () => {
      apply(parsed, fileName);
      afterApply?.();
    };
    if (rows.length === 0) {
      done();
      return;
    }
    confirm({
      title: `替换现有 ${rows.length} 行数据`,
      detail: `将用「${fileName}」里的 ${parsed.rows.length} 行替换当前数据；这一步不能撤销（已经导出的文件不受影响）。`,
      items: parsed.rows
        .slice(0, 8)
        .map((row) => `${row.index}. ${row.title || '（无标题）'} → ${row.content || '（内容为空）'}`),
      confirmLabel: `替换为 ${parsed.rows.length} 行`,
      onConfirm: done,
    });
  };

  const load = async (file: File) => {
    setBusy(true);
    setError('');
    try {
      commit(await parseDataFile(file), file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '文件解析失败');
    } finally {
      setBusy(false);
    }
  };

  const loadPaste = () => {
    setError('');
    try {
      commit(parsePastedText(pasteText), '粘贴的数据', () => {
        setPasteOpen(false);
        setPasteText('');
      });
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
          bgcolor: 'var(--tint-band)',
          borderTop: '1px solid var(--rule)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <Typography sx={{ fontSize: FONT_PX.label, fontWeight: 700 }}>批量数据源</Typography>
        <Typography sx={{ fontSize: FONT_PX.meta, fontFamily: MONO_FONT, color: 'text.secondary' }}>
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
              onClick={() =>
                confirm({
                  title: `清空 ${rows.length} 行数据`,
                  detail: '会同时清掉导入信息与提醒；这一步不能撤销（已经导出的文件不受影响）。',
                  items: rows.slice(0, 8).map((row) => `${row.index}. ${row.title || '（无标题）'} → ${row.content || '（内容为空）'}`),
                  confirmLabel: '清空数据',
                  onConfirm: () => {
                    store.setRows([]);
                    store.setBatch(null);
                    store.setSelectedIds([]);
                  },
                })
              }
            >
              清空数据
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

        <Typography sx={{ fontSize: FONT_PX.meta, color: 'text.secondary', lineHeight: 1.5 }}>
          CSV / TSV / TXT / JSON / XLSX 都能读；分隔符自动嗅探，Excel 另存的 GBK 自动识别。老式 .xls 请先另存为 xlsx
          或 csv。数据只存在这台机器上，改动自动保存；表格里可直接改标题与内容、增删行。
        </Typography>

        {batch ? (
          <Typography sx={{ fontSize: FONT_PX.meta, fontFamily: MONO_FONT, color: 'text.secondary', lineHeight: 1.5 }}>
            {batch.fileName} · {DATA_FORMAT_LABEL[batch.format]} · {batch.encoding.toUpperCase()} ·{' '}
            {batch.hasHeader ? '有表头' : '无表头'}
            {batch.warnings.length ? ` · ${batch.warnings.length} 条提醒` : ''}
          </Typography>
        ) : null}

        {rowsStorageError ? (
          <Typography sx={{ fontSize: FONT_PX.meta, color: 'text.primary', lineHeight: 1.5 }}>
            · 本机存储写入失败：本次改动不会保留（{rowsStorageError}）。请清理浏览器存储，或换一个非隐私窗口再来。
          </Typography>
        ) : null}

        {batch?.warnings.length ? (
          <Box sx={{ borderLeft: '1px dashed var(--rule-strong)', pl: 1 }}>
            {(warningsOpen ? batch.warnings : batch.warnings.slice(0, 4)).map((warning, index) => (
              <Typography key={index} sx={{ fontSize: FONT_PX.meta, color: 'text.secondary', lineHeight: 1.5 }}>
                {warning}
              </Typography>
            ))}
            {batch.warnings.length > 4 ? (
              <Typography
                role="button"
                tabIndex={0}
                onClick={() => setWarningsOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setWarningsOpen((open) => !open);
                  }
                }}
                sx={{
                  fontSize: FONT_PX.meta,
                  color: 'text.secondary',
                  lineHeight: 1.5,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                {warningsOpen ? '收起提醒' : `还有 ${batch.warnings.length - 4} 条…`}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {error ? <Typography sx={{ fontSize: FONT_PX.meta, color: 'text.primary' }}>· {error}</Typography> : null}
      </Stack>
    </Box>
  );
}