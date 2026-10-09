import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, CssBaseline, Stack, ThemeProvider, Typography } from '@mui/material';
import './index.css';
import App from './App';
import { LineMark } from './components/StateLine';
import { MONO_FONT, theme } from './theme';

/**
 * 兜底错误边界：渲染期抛出的异常绝不能让整页白屏（曾经有一次内容超出二维码容量，整棵树被卸掉）。
 *
 * 只管两件事：把异常收成一句人话、给一个「重新载入」。措辞与标记沿用别处的工单语言——
 * 虚线说明 + 次级墨等宽字，不新增颜色，也不为它引入依赖。
 *
 * 注意边界只兜渲染期：事件回调、定时器、动画帧里的异常要各自收拾干净（缩略图出片就在做这件事）。
 */
class Boundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state: { message: string | null } = { message: null };

  static getDerivedStateFromError(cause: unknown) {
    return { message: cause instanceof Error && cause.message ? cause.message : '原因不明' };
  }

  componentDidCatch(cause: Error) {
    // 白屏时界面只剩一句人话，细节留给控制台
    console.error('界面出错了', cause);
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <Stack sx={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', gap: 1.25, px: 3, bgcolor: 'var(--ground)' }}>
        <Stack sx={{ maxWidth: 480, gap: 0.75 }}>
          <LineMark form="dashed" width={22} />
          <Typography sx={{ fontSize: 12.5 }}>界面出错了：{this.state.message}</Typography>
          <Typography sx={{ fontSize: 11, fontFamily: MONO_FONT, color: 'text.secondary', lineHeight: 1.5 }}>
            参数与数据都存在本机，重新载入不会丢；要是还出错，请照着上面这句话记下来。
          </Typography>
        </Stack>
        <Button size="small" variant="outlined" onClick={() => window.location.reload()}>
          重新载入
        </Button>
      </Stack>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Boundary>
        <App />
      </Boundary>
    </ThemeProvider>
  </StrictMode>,
);