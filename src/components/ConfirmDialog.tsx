/**
 * 删除确认：删行、清空数据、删预设都走这一个对话框。
 *
 * 破坏性动作要「点名对象 + 明确后果 + 可取消」：列表里直接写出即将删除的东西，
 * 超过 8 条折叠成「等共 N 项」，避免出现「你确定吗？」这种说不出对象的确认。
 */
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { INK, MONO_FONT } from '../theme';

export interface ConfirmRequest {
  /** 对话框标题，例如「删除 3 行数据」 */
  title: string;
  /** 说明后果的一句话 */
  detail: string;
  /** 即将被删除的对象（会逐条列出来） */
  items: string[];
  /** 确认按钮文字，例如「删除」 */
  confirmLabel: string;
  onConfirm: () => void;
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  const shown = request ? request.items.slice(0, 8) : [];
  return (
    <Dialog
      open={Boolean(request)}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 0, border: `1px solid ${INK}` } } }}
      aria-labelledby="confirm-title"
    >
      <DialogTitle id="confirm-title" sx={{ fontSize: 14, fontWeight: 700, pb: 1 }}>
        {request?.title ?? ''}
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{request?.detail ?? ''}</Typography>
        <Stack sx={{ borderTop: '1px solid var(--rule)' }}>
          {shown.map((item, index) => (
            <Typography
              key={`${index}-${item}`}
              sx={{
                fontSize: 11.5,
                fontFamily: MONO_FONT,
                py: 0.4,
                borderBottom: '1px solid var(--rule)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item}
            </Typography>
          ))}
          {request && request.items.length > shown.length ? (
            <Typography sx={{ fontSize: 10.5, color: 'text.secondary', py: 0.4 }}>
              等共 {request.items.length} 项
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 1.5, gap: 1 }}>
        <Button size="small" variant="outlined" onClick={onClose}>
          取消
        </Button>
        <Button
          size="small"
          variant="contained"
          autoFocus
          onClick={() => {
            request?.onConfirm();
            onClose();
          }}
        >
          {request?.confirmLabel ?? '删除'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}