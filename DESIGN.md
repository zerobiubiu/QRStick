---
name: QRStick 码贴生成器
description: 印刷工单与印张 —— 纸白、墨黑、发丝线的可打印二维码标签车间
colors:
  ink: "#101010"
  paper: "#ffffff"
  ground: "#f4f4f2"
  rule: "rgba(16,16,16,0.16)"
  rule-strong: "rgba(16,16,16,0.34)"
  ink-secondary: "rgba(16,16,16,0.62)"
  ink-disabled: "rgba(16,16,16,0.45)"
  tint-footer: "rgba(16,16,16,0.02)"
  tint-band: "rgba(16,16,16,0.035)"
  tint-hover: "rgba(16,16,16,0.04)"
  tint-current-row: "rgba(16,16,16,0.05)"
  cyan: "#0093d0"
  magenta: "#e5007d"
  yellow: "#ffe200"
  press-cyan: "#00a0e9"
  press-magenta: "#e6007e"
  press-yellow: "#fff200"
  press-black: "#231815"
  guide-blue: "rgba(0,160,233,0.55)"
  selection-cyan: "rgba(0,147,208,0.24)"
typography:
  wordmark:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tabular-nums"
  body-small:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "12px"
    fontWeight: 400
  label:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
  section-title:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
  meta:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "10.5px"
    fontWeight: 400
  micro:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "10px"
    fontWeight: 400
  readout:
    fontFamily: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    fontFeature: "tabular-nums"
  ruler:
    fontFamily: "'Cascadia Mono', Consolas, 'DejaVu Sans Mono', Menlo, monospace"
    fontSize: "9px"
    fontWeight: 400
  button:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "13px"
    fontWeight: 600
  control:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "12px"
    fontWeight: 600
  tooltip:
    fontFamily: "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif"
    fontSize: "11px"
    fontWeight: 400
  sheet-title:
    fontFamily: "'Microsoft YaHei' | 'SimSun' | 'KaiTi' | 'Cascadia Mono'（fonts.ts 四选一，随系统安装）"
    fontSize: "4–400pt（默认 32pt），落地像素 = pt / 72 × DPI"
    fontWeight: 700
rounded:
  none: "0px"
spacing:
  "0.25": "2px"
  "0.5": "4px"
  "0.6": "4.8px"
  "0.75": "6px"
  "1": "8px"
  "1.25": "10px"
  "1.5": "12px"
  "1.75": "14px"
  "2": "16px"
  strip: "22px"
  field-label-column: "96px"
components:
  button-outlined:
    backgroundColor: "transparent"  # 绘在工单纸白上，自身不着色
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "26px"
  button-contained:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 10px"
    height: "26px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"  # 工单里的实例再覆写成次级墨
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 8px"
    height: "26px"
  segment:
    backgroundColor: "transparent"  # 浮在工单纸白之上，自身不着色
    textColor: "{colors.ink-secondary}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "5px 10px"
  segment-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "5px 10px"
  input-text:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "6px 9px"
    width: "82px（数字格默认；字号格 84 / DPI 格 92 / 静默区 92 / 下拉 100% / 长宽比 96）"
  select:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "6px 9px"
    width: "100%"
  field-row:
    backgroundColor: "transparent"  # 工单本身是纸白，字段行不再叠一层
    rounded: "{rounded.none}"
    padding: "8px 16px"
  docket-section:
    backgroundColor: "{colors.tint-band}"
    rounded: "{rounded.none}"
    padding: "6px 16px"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    size: "屏幕：sheetWidthMm × pxPerMm（pxPerMm ≤ 4，四舍五入到整像素）；导出：widthMm × heightMm @ DPI"
  state-line:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.readout}"
    rounded: "{rounded.none}"
    padding: "6px 14px"
  data-grid:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.none}"
    padding: "6px 14px"
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.tooltip}"
    rounded: "{rounded.none}"
    padding: "5px 7px"
---

# Design System: QRStick 码贴生成器

## Overview

**Creative North Star: "印刷工单与印张"**

界面是一张待付印的印张摊在看版台上，台面灰底、四角钉着四色套准十字，贴着纸边是一把按当前屏幕密度现算的毫米刻度尺；左边夹着一张联单工单，每个参数都是「字段名 : 值」的一格，按规格 / 标题 / 二维码 / 数据 / 体检分段。这不是贴上去的皮：产品真实的机制就是「参数 → 印张 → 交付文件」，工单与印张正好是这个对应关系（源码：`docs/decisions/0001-界面语言-印刷工单与印张.md`）。

整套系统只有两种材料——墨（`#101010`）与纸（`#ffffff`），加一块台面灰（`#f4f4f2`）。层级全部由 1 物理像素的发丝线、墨的透明度梯度、以及三条 1.5px 重线分界承担；没有圆角、没有卡片、没有阴影堆叠。印刷三原色只在极小面积上出现：套准十字的四条色版臂、焦点环、选中底色。数字一律等宽对齐，尺寸一律带单位（mm / DPI / pt），因为这套界面最终要落到实物上。

密度是车间密度：正文 13px，元数据 10.5–11px，读数条一行六格，字段行上下各 8px 内边距、按钮与分段最小高 26px、数字格内边距 6px 9px。参数改动即时重排印张，没有「应用」这一步；破坏性动作（恢复默认）被隔离到工单最底部并附说明。窄屏时参数与读数先让位，印张与导出永不被挤掉——优先级塌缩是这个世界的秩序。

**Key Characteristics:**
- 直角是唯一的形：全局 `borderRadius: 0`，滑块拇指是 10 × 16 的立式矩形，复选框方角。
- 发丝线承担全部层级：`1px solid rgba(16,16,16,0.16)` 分层，`1px solid rgba(16,16,16,0.34)` 描边控件，`1.5px solid #101010` 只画三条边界重线。
- 状态只用线型：实线已生效 / 点划线出片中 / 双线已导出 / 虚线有提醒，全站没有彩色状态。
- 颜色是标记而不是装饰：三原色与色标条都按毫米级面积出现，界面主体永远是墨黑 / 纸白。
- 数字等宽 + 单位标注：读数、序号、型号一律等宽字体与 `tabular-nums`，每个尺寸写明 mm / DPI / pt。
- 零网络资源：不引网络字体、无插图、无位图（唯一的图形是 SVG 刻线与套准十字），离线可出正确的图。

## Colors

调色板是印刷车间的材料表：纸、墨、台面灰，加两组只在标记位出现的原色。中间调一律由墨的 alpha 产生，不出现任何灰色 hex。

### Primary
- **墨黑 Ink** (`#101010`，源码：`src/theme.ts:12`、`src/index.css:9`)：全站唯一的文字色、线色与实底填充色。主按钮实底（付印 PDF）、分段按钮选中态、表格当前行描边、印张上的标题与二维码模块都用它。它同时是「第四条色版」——套准十字右下臂。
- **没有彩色状态色**：调色板里的 `error` 就是墨黑本身（`error: { main: INK }`，源码：`src/theme.ts:40-42`），红 / 黄 / 绿已被删除。状态一律由线型与文案承担：错误消息用墨黑文字加双线标记，提醒用次级墨加虚线标记，导出失败的尾注写成「· 导出失败：…」并保持墨色（`src/components/Docket.tsx:585-593`、`src/components/StateLine.tsx:84-86`）。

### Secondary
- **青 Cyan** (`#0093d0`，源码：`src/theme.ts:17`)：界面里只做三件事——`2px` 焦点环（`:focus-visible`，`src/index.css:50-53`）、选区底色 `rgba(0,147,208,0.24)`（`src/index.css:46-48`）、套准十字上臂（`src/components/PressSheet.tsx:25`）。
- **品红 Magenta** (`#e5007d`，源码：`src/theme.ts:18`)：套准十字下臂（`src/components/PressSheet.tsx:26`）。
- **黄 Yellow** (`#ffe200`，源码：`src/theme.ts:19`)：套准十字左臂（`src/components/PressSheet.tsx:27`）。

### Tertiary
只印在导出件的纸面上，界面从不用它们（唯一出现处是渲染核 `src/lib/render.ts`）。
- **过程青 Process Cyan** (`#00a0e9`)、**过程品红 Process Magenta** (`#e6007e`)、**过程黄 Process Yellow** (`#fff200`)、**过程黑 Process Black** (`#231815`)（源码：`src/lib/render.ts:21`）：色标条的前四格。
- **过程补色** (`#00807a` / `#7a3f00` / `#007a2f`，源码：`src/lib/render.ts:309`)：色标条后四格的另外三格，第八格是墨黑。
- **参考蓝 Guide Blue** (`rgba(0,160,233,0.55)`，源码：`src/lib/render.ts:281`)：页边距参考虚线，只在导出件上。

### Neutral
- **纸白 Paper** (`#ffffff`，源码：`src/theme.ts:13`)：工单底、输入框底、印张纸面、数据表底。
- **台面灰 Ground** (`#f4f4f2`，源码：`src/theme.ts:14`)：应用底色与看版台底色，让纸白有地方站着。
- **发丝线 Rule** (`rgba(16,16,16,0.16)`，源码：`src/theme.ts:15`，导出为 `hairline` = `1px solid ${RULE}`，`src/theme.ts:26`)：字段行、分段标题带、读数条、单元格的分层线。
- **强线 Rule Strong** (`rgba(16,16,16,0.34)`，源码：`src/theme.ts:16`)：控件轮廓——按钮、输入框 fieldset、菜单纸、分段按钮相邻边框、滑杆轨道、未选中复选框（`src/theme.ts:145`）。
- **次级墨 Ink Secondary** (`rgba(16,16,16,0.62)`，源码：`src/theme.ts:37`)：字段名、字段提示、元数据、未选中分段按钮的文字、状态行的空闲读数。
- **禁用墨 Ink Disabled** (`rgba(16,16,16,0.45)`，源码：`src/theme.ts:38`)：最轻的一档文字墨，当前只用于批量数据源的折叠提示「还有 N 条…」（`src/components/BatchSource.tsx:120`）。
- **墨洗四档**：页脚洗 `rgba(16,16,16,0.02)`（`src/components/Docket.tsx:607`）、分段标题带 / 行悬停洗 `rgba(16,16,16,0.035)`（`src/components/Docket.tsx:157`、`src/components/BatchGrid.tsx:80`、`src/components/BatchSource.tsx:52`）、按钮悬停洗 `rgba(16,16,16,0.04)`（`src/theme.ts:71`）、当前行洗 `rgba(16,16,16,0.05)`（`src/components/BatchGrid.tsx:115`）。
- **读数墨**：刻度尺数字 `rgba(16,16,16,0.6)`（`src/components/PressSheet.tsx:98`）、套准十字底纹 `rgba(16,16,16,0.55)`（`src/components/PressSheet.tsx:23`）、空内容占位框 `rgba(16,16,16,0.28)`（`src/lib/render.ts:140`）、色标条上沿 `rgba(16,16,16,0.85)`（`src/lib/render.ts:315`）、滚动条悬停 `rgba(16,16,16,0.54)`、备用读数墨 `rgba(16,16,16,0.7)`（`src/index.css:10-11`）。

### Named Rules
**The Three-Ink Rule（三原色只做标记）.** 青 / 品红 / 黄永远不做文字色、不做背景色、不做边框色。它们只出现在：套准十字的四条色版臂（各 1.2px 宽、2.5px 长的短线）、焦点环、选中底色、色标条。检验方法：把界面截成灰度图，若某处原色消失后信息就丢了，说明它被当成了装饰以外的用途——那是错的用法。

**The Four-Wash Rule（墨洗只有四档）.** 背景层次只能用 `0.02 / 0.035 / 0.04 / 0.05` 这四个墨洗，选哪一档由元素职责决定（页脚 / 分段带 / 悬停 / 当前行），不按喜好挑选。需要更深的底就用实底墨黑（那意味着它是主按钮或选中态），需要更浅就退回纸白。

**The No-Grey Hex Rule（灰不出现）.** 所有中间调都是 `#101010` 的 alpha，不引入灰色 hex 值。屏幕上唯一非墨非纸的颜色就是三原色标记，以及只印在纸面上的过程色。

**The No-Colour-State Rule（状态不着色）.** 这套系统里不存在彩色状态：调色板的 `error` 就是墨黑（`src/theme.ts:40-42`），错误、提醒、进行中、完成全靠线型加文案前缀区分。任何新状态先回答「它的线型是什么」，答不出来就说明它不是状态而是内容。色觉障碍者与黑白打印都受益。

## Typography

**Display Font:** 无。"展示字体"在这个世界里不存在——最大的界面字是 15px 的站名（`src/App.tsx:86`），此外就是按 pt 驱动的标签标题。
**Body Font:** 系统无衬线栈 `'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', sans-serif`（`src/theme.ts:21-22`，CSS 变量 `--ui-font`，`src/index.css:19`）。
**Label/Mono Font:** `'Cascadia Mono', Consolas, 'DejaVu Sans Mono', Menlo, monospace`（`src/theme.ts:23`，`--mono-font`）——所有读数、序号、版本号、型号。
**标签字体:** 印张上的标题另有四种系统字体可选（黑体 / 宋体 / 楷体 / 等宽），每种带 `stack`（浏览器）与 `docxName`（Word 只认单个字体名）两套名字（`src/lib/fonts.ts:15-40`）。

**Character:** 界面是联单上打印出来的字：无字距、无大写变形、无斜体，靠字重（400 / 600 / 700）与字号分级，靠等宽字体把数字钉在列里。它读起来像车间单据，不像网页。

### Hierarchy
- **Wordmark** (700, 15px, letter-spacing -0.01em)：站名 `QRStick` 一处（`src/App.tsx:86`），相邻 11.5px 次级墨副题。
- **Section Title** (700, 11.5px)：联单分段标题（规格 / 标题 / 二维码 / 数据 / 体检）与数据表标题（`src/components/Docket.tsx:162`、`src/components/BatchGrid.tsx:85`）。
- **Body** (400, 13px, line-height 1.45, tabular-nums)：全局正文与输入框文字（`src/theme.ts:47`、`src/index.css:38-42`）。
- **Body Small** (400, 12px)：数据表（`src/components/BatchGrid.tsx:104`）、分段按钮与菜单标签（`src/theme.ts:98`、`src/theme.ts:127`）。
- **Field Label** (400, 11.5px, 次级墨)：联单字段名（`src/components/Docket.tsx:65`）。
- **Readout** (400, 11px, 等宽)：读数条数值、表头读数、状态行文字（`src/components/PressSheet.tsx:144`、`src/components/BatchGrid.tsx:85`、`src/components/StateLine.tsx:80`）。
- **Meta** (400, 10.5px, line-height 1.35)：字段提示（次级墨）、单位后缀、分段标题右侧读数、页脚说明（`src/components/Docket.tsx:73`、`src/components/Docket.tsx:164`、`src/components/Docket.tsx:212`、`src/components/Docket.tsx:614`）。
- **Micro** (400, 10px, line-height 1.2)：读数条的字段名（`src/components/PressSheet.tsx:143`）。
- **Ruler** (400, 9px, 等宽, 读数墨 0.6)：毫米刻度尺的数字（`src/components/PressSheet.tsx:98`、`src/components/PressSheet.tsx:125`）。
- **Sheet Title** (700 或 400, 4–400pt，默认 32pt)：印张上的标题，字号是磅、落地像素 = `pt / 72 × DPI`，行高倍数 0.8–2.5（默认 1.25）（`src/lib/units.ts:40-42`、`src/lib/render.ts:191-193`、`src/state/labelStore.ts:25`）。

### Named Rules
**The Tabular Rule（数字必等宽）.** 任何会被比对、核对、抄写的数字（读数、序号、DPI、mm、pt、模块边长）用等宽字体，并在全局叠上 `font-variant-numeric: tabular-nums`（`src/index.css:41`）。比例字体的数字只允许出现在正文叙述里，不允许出现在读数位。

**The Installed-Fonts Rule（只用装好的字体）.** 不引任何网络字体（`src/lib/fonts.ts:4-5` 的注释就是这条纪律）。标签字体必须是操作者机器上装好的字体，因为 PDF / Word 要在离线环境里渲染出正确的字——选一个下不到的字体，导出的标签就会换字。

**The One Ramp Rule（字号只走八级）.** 界面字号只取 15 / 13 / 12 / 11.5 / 11 / 10.5 / 10 / 9 这八级，从不即兴加值；标签标题的磅值是唯一的例外，因为它是印件参数不是界面字号。

**The No-Case Rule（不改字形）.** `textTransform: none`、`letterSpacing: 0`（`src/theme.ts:55`、`src/theme.ts:98`）——中文不需要大写变形，字距交给字体本身。唯一例外是站名的 `-0.01em`。

## Layout

**外壳**：`height: 100dvh` 的纵向 flex，顶栏 `flex: 0 0 auto`（`src/App.tsx:78-82`），主体是 CSS Grid——`md`（MUI 默认断点 900px）以上 `392px minmax(0,1fr)`（左侧工单固定宽、右侧印张吃掉剩余），`md` 以下单列 `minmax(0,1fr)`（`src/App.tsx:129-130`）。窄屏时顺序反转：印张 `order: 1` 在上，工单 `order: 2` 在下（`src/App.tsx:134`、`src/App.tsx:140`）。

**间距语汇**：MUI 的 8px 单位，`sx` 只取 `0.25 / 0.5 / 0.6 / 0.75 / 1 / 1.25 / 1.5 / 1.75 / 2` 这些倍数（= 2 / 4 / 4.8 / 6 / 8 / 10 / 12 / 14 / 16px）。最常出现的三档：字段行内边距 `8px 16px`、分段标题带 `6px 16px`、工单页脚 `10px 16px`（`src/components/Docket.tsx:57-58`、`src/components/Docket.tsx:155-157`、`src/components/Docket.tsx:604-605`）。字段行是 `96px minmax(0,1fr)` 的两列栅格，列距 12px、行距 4px（`src/components/Docket.tsx:53-56`）——字段名的宽度固定，值永远从同一列起排，这是联单的对齐。

**看版台与刻度尺**：台面内边距与刻度带宽度同为 `STRIP_PX = 22px`（`src/components/PressSheet.tsx:17`、`src/components/PressSheet.tsx:199`、`src/components/PressSheet.tsx:222-223`），印张在台面居中（`placeContent: center`，`src/components/PressSheet.tsx:198`），四角套准十字以 `inset: 6px` 钉住（`src/components/PressSheet.tsx:203`）。每毫米像素数由台面实测尺寸反算，上限 4（`src/components/PressSheet.tsx:171-180`）；刻度步长随密度自动降档为 1 / 2 / 5 / 10 mm，标注每 ≥34px 一个（`src/components/PressSheet.tsx:69-78`）；`pxPerMm ≤ 0.4` 时整块印张不画（`src/components/PressSheet.tsx:218`），免得画出一张糊纸。预览画布最长边 1800px 等比降采样，导出永远满 DPI（`src/components/PressSheet.tsx:16`、`src/components/PressSheet.tsx:153`）。

**读数条**：印张下沿一行六格（印张 / 分辨率 / 二维码 / 标题 / 版心 / 内容），每格 `6px 12px` 并与左邻共用一条发丝线（`src/components/PressSheet.tsx:247-267`，格子定义在 `:140-147`）；窄屏不换行改为横向滚动，`md` 以上才允许换行（`src/components/PressSheet.tsx:251-253`）。

**窄屏高度**：批量数据表 340px、单张（非批量）时印张 460px、批量窄屏下的印张 360px（`src/App.tsx:159`、`src/App.tsx:147`、`src/App.tsx:176`）。这些是显式像素而不是 `auto`——窄屏这张栅格列本身没有可分的剩余高度，必须自带高度；批量数据表还额外带 `flex: '0 0 auto'`，免得被同级内容按 flex 规则压缩（`src/App.tsx:145-147`、`src/App.tsx:153-155` 的注释与取值）。

**批量布局**：`lg`（MUI 默认断点 1200px）以上数据表与印张并排 `minmax(0,1.3fr) minmax(0,1fr)`，报表更宽；`lg` 以下印张掉到数据表下方（`src/App.tsx:158`、`src/App.tsx:163-167`）。

**默认印张**：A4 纵向、300 DPI、页边距 12mm、二维码 60mm、纠错 M、标题 32pt 加粗居中在码上方、**四角裁切标记默认打开**（色标条与参考虚线默认关）（`src/state/labelStore.ts:14-35`）。

### Named Rules
**The Priority-Collapse Rule（优先级塌缩）.** 空间不够时按顺序牺牲：低优先级参数收进「更多规格」（窄屏默认收起，`src/components/Docket.tsx:553-563`）→ 读数条改为横滑（`src/components/PressSheet.tsx:251-253`）→ 参数区下沉。印张与导出按钮在任何屏宽下都不被挤掉，因为它们是这个工具的全部产出。

**The Millimetre Rule（毫米是版面真相）.** 一切版面尺寸以毫米书写、按 DPI 换算成整数像素落地，再回读成毫米显示（`src/lib/units.ts:9`、`src/lib/units.ts:25-36`、`src/lib/render.ts:181-186`）。界面里出现的每个尺寸都带单位；屏幕缩放（`scale`）只影响预览，不影响导出。

**The Isolated Destructive Rule（破坏性动作隔离）.** 「恢复默认」不放在参数中间，它单独占工单底部一行，带 1.5px 墨线分界与一句说明（`src/components/Docket.tsx:603-621`）。

## Elevation & Depth

这个系统**不用阴影堆叠**。深度由三样东西表达：发丝线（分层）、墨洗（分区底色）、重线（边界）。MUI 的默认高度语汇被逐条关掉：`Paper` 默认 `elevation: 0` + `square` + `backgroundImage: none`（`src/theme.ts:58-60`），按钮默认 `disableElevation`（`src/theme.ts:63`），滑杆拇指在悬停与聚焦时 `boxShadow: 'none'`（`src/theme.ts:139`），数据表当前行用内描边而不是投影（`outline: 1px solid #101010; outlineOffset: -1`，`src/components/BatchGrid.tsx:115`）。

**唯一的例外是印张本身。** 一张纸放在台面上有物理厚度，所以只有印张带投影：`0 1px 1.5px rgba(16,16,16,0.16), 0 18px 34px -18px rgba(16,16,16,0.34)`（`src/components/PressSheet.tsx:238`）——近处一条 1px 接触影 + 远处一层 34px 扩散，模仿纸边翘起的漫射影。除此之外，任何元素都不许投影。

### Shadow Vocabulary
- **Sheet Lift**（`0 1px 1.5px rgba(16,16,16,0.16), 0 18px 34px -18px rgba(16,16,16,0.34)`，`src/components/PressSheet.tsx:238`）：只用于看版台上的印张。这是全系统唯一的投影。
- **上墨一次**（`opacity 0.42 / blur(0.6px)` → `1 / 0`，180ms，`src/index.css:81-94`）：不是阴影，是印张每次重排时的一次上墨，见 Components 的动效说明。

### Named Rules
**The Hairline Rule（发丝线承担层级）.** 分区、分隔、描边一律用 1px 线：分层线 `rgba(16,16,16,0.16)`、控件轮廓 `rgba(16,16,16,0.34)`。需要更强的分隔就加粗到 1.5px 墨黑，绝不加阴影。

**The Single-Shadow Rule（唯一投影）.** 全站只有印张可以投影，理由是纸在台面上的物理抬升。新增投影=新增一个不存在的物理层。悬停、聚焦、选中一律用线型或底色变化回应，不用抬高。

**The Heavy-Rule Rule（重线分界）.** 1.5px 墨黑线只画三条边界：顶栏下沿（`src/App.tsx:82`）、工单底栏上沿（`src/components/Docket.tsx:606`）、数据表表头下沿（`src/components/BatchGrid.tsx:108`）。它标的是「单据的固定边」，不是强调手段。

## Shapes

**直角是这个世界的物理事实。** `shape: { borderRadius: 0 }`（`src/theme.ts:44`）并在每个组件上重申：按钮、分段按钮组、输入框、菜单纸、滑杆拇指、复选框（`src/theme.ts:66`、`:87`、`:96`、`:114`、`:126`、`:134`、`:145`、`:150`）。圆角是屏幕的语法，印件上没有；这条是最先被确立、也最不该被打破的一条。

**矩形是唯一的形。** 立式滑块拇指 10 × 16（`width: 10, height: 16, marginTop: -5, marginLeft: -5` 让它骑在轨道上居中，`src/theme.ts:134-138`）；复选框方角、内边距 5px（`src/theme.ts:145`）；滚动条 11 × 11，拇指用 `3px` 透明边 + `background-clip: content-box` 收成一根细条（`src/index.css:60-78`）。

**相邻即重叠。** 分段按钮之间用 `marginLeft: '-1px !important'` 拼合（`src/theme.ts:87-88`），相邻边框只留 1px 一条——这是印刷里「拼版不叠线」的做法，避免出现 2px 双线。

**线型是形态词汇。** 状态与问题全部用线的形态表达（`src/components/StateLine.tsx:19-49`）：

| 线型 | 参数 | 含义 |
| --- | --- | --- |
| 实线 solid | `strokeWidth 1.2`，无虚线 | 已生效（当前参数正在出这张印张） |
| 点划线 dashdot | `strokeWidth 1.6`，`strokeDasharray '7 3 1.5 3'` | 正在出片（导出进行中） |
| 双线 double | 两条 `strokeWidth 1.6` 的平行线（y = 4.5 / 7.5），标记 34 × 12 | 已导出（付印完成） |
| 虚线 dashed | `strokeWidth 1.2`，`strokeDasharray '5 3'` | 有提醒（体检有警） |
| 虚线（缩窄 22px） | 同上 | 体检清单里的单条问题标记（`src/components/Docket.tsx:588`） |

印件上另有两种线：页边距参考虚线（`rgba(0,160,233,0.55)`，2mm / 1.5mm 节奏，`src/lib/render.ts:281-283`）与空内容占位框（`rgba(16,16,16,0.28)`，虚线 `边长/16` 与 `边长/24`，`src/lib/render.ts:140-143`）。

**刻度尺的几何**：刻度带 22px 宽，主刻度 9px、次刻度 4px，`strokeWidth` 1 / 0.7，透明度 0.75 / 0.4（`src/components/PressSheet.tsx:85-133`）。刻度是测量工具，长度随印张尺寸与屏幕密度实时变化。

**套准十字的几何**：17 × 17 的方框里，`r = 4` 的圆与十字基准线（0.7px，`rgba(16,16,16,0.55)`）之上，四条 1.2px 的色版臂各指向一方——上青、下品红、左黄、右墨（`src/components/PressSheet.tsx:20-30`）。

### Named Rules
**The Right-Angle Rule（直角）.** 任何圆角都是错误的，包括拇指、复选框、提示条与滚动条。例外为零。

**The Line-Form Rule（形态即状态）.** 状态必须是线的形态，不是色块、不是图标、不是徽章。四种线型的含义固定，不可发明第五种；需要新状态时先问它能不能落在已生效 / 出片中 / 已导出 / 有提醒这四态里。

**The Overlap Rule（拼合不叠线）.** 相邻同级元素共用一条边框（分段按钮 -1px 重叠、读数格共用左线），不许出现两条并排的 1px 线冒充 2px。

## Components

### Buttons
- **Shape:** 直角（`borderRadius: 0`），1px 强线轮廓（`1px solid rgba(16,16,16,0.34)`），无阴影（`disableElevation`）（`src/theme.ts:63-81`）。
- **Default (outlined):** 透明底 + 墨黑字，绘在工单纸白上。小号（本产品全部按钮都是小号）：高 26px、左右内边距 10px、12px/600（`src/theme.ts:79-80`）。默认号另有 32px 高 / 14px 内边距 / 13px 字的定义备用（`src/theme.ts:67-68`）。
- **Primary (contained):** 墨黑实底 + 纸白字，悬停时底与边一起压到纯黑 `#000`（`src/theme.ts:73-77`）。全站只有「付印 PDF」这一个按钮用它（`src/App.tsx:111`）——主按钮的独占地位留给最终产出。
- **Text:** 透明边（`border: 1px solid transparent`），左右内边距 8px，只用于「更多规格（静默区）/ 收起更多规格」这类展开开关（`src/theme.ts:79`、`src/components/Docket.tsx:559-561`）。
- **Hover / Focus:** 悬停把边框提到墨黑并叠一层 `0.04` 墨洗（`src/theme.ts:71`）；键盘焦点用全局 `2px` 青色轮廓 + `1px` 偏移（`src/index.css:50-53`）。过渡交给 MUI 默认，这里不额外定义。

### Segmented Controls
- **Style:** 分段按钮组把选项拼成一条连续的带子：`borderRadius: 0 !important`、`marginLeft: -1px !important`、相邻边框色 `rgba(16,16,16,0.34)`（`src/theme.ts:83-91`）。
- **Unselected:** 透明底、次级墨文字（`rgba(16,16,16,0.62)`）、12px/600、内边距 `5px 10px`（`src/theme.ts:96-102`）。
- **Selected:** 反白——墨黑实底 + 纸白字，悬停压到纯黑（`src/theme.ts:103-107`）。选中不靠颜色或阴影，靠反白，所以灰度打印仍然清楚。
- **用途:** 纸张方向、标题对齐、标题位置、粗细、纠错等级、DPI 预设、单张/批量模式（`src/components/Docket.tsx:292-303`、`src/App.tsx:90-101`）。

### Fields（联单字段行）
- **The Field Row:** 参数区唯一的输入形态，`96px minmax(0,1fr)` 两列栅格，列距 12px、行距 4px、内边距 `8px 16px`、下沿发丝线（`src/components/Docket.tsx:37-75`，栅格见 `:53-56`）。字段名 11.5px 次级墨，值从第 2 列起排（`:65`）；提示文字占第 2 列、10.5px 次级墨、行高 1.35（`:73`）。
- **Number Field:** 默认宽 82px（字号格 84、DPI 格 92、静默区 92），等宽字体、内边距上下 6px，右侧可挂单位后缀（10.5px 次级墨，如 `mm` / `DPI` / `pt` / `倍` / `模块`）（`src/components/Docket.tsx:172-219`，后缀在 `:212`）。输入即时提交并裁剪到区间，空串不提交（`:197-207`）。
- **Select:** 纸白底、13px、内边距 `6px 9px`（`src/theme.ts:114-124`）；字体下拉的每个选项用该字体自己的 `stack` 渲染，所见即所选（`src/components/Docket.tsx:400-410`）。
- **Text Area:** 标题 2–4 行、二维码内容 2–5 行等宽（`src/components/Docket.tsx:82-93`）。
- **Focus:** 聚焦时 fieldset 保持 1px、只把颜色换成墨黑——不加粗、不发光（`src/theme.ts:119`）。

### Slider
- **Style:** 墨黑轨道与拇指，轨道底为强线 `rgba(16,16,16,0.34)`（不透明），拇指是 10 × 16 直角矩形，上下内边距 10px（`src/theme.ts:128-141`）。
- **Role:** 永远与一个数字格成对出现，滑杆给手感、数字给精度；滑杆的显示区间比数字格的最大值窄（如字号数字 4–400pt，滑杆只到 160pt）（`src/components/Docket.tsx:410-432`、`src/components/Docket.tsx:508`）。

### Checkbox、Menu、Tooltip
- **Checkbox:** 小号、直角、内边距 5px；未选中用强线墨色（`rgba(16,16,16,0.34)`），选中用墨黑（`src/theme.ts:143-145`）；标签 12px、左边距 -6px 抵消 MUI 内边距（`src/theme.ts:161`）。
- **Menu:** 纸白纸面 + 1px 强线边框 + `marginTop: 2px`，选项高 32px、13px（`src/theme.ts:126-127`）。
- **Tooltip:** 墨黑底 + 纸白字、直角、11px、内边距 `5px 7px`、最大宽 260px，箭头同墨色（`src/theme.ts:147-156`）。工具提示只解释按钮后果（如「恢复到出厂的默认参数；批量数据不会被删除」），不复述标签文字（`src/components/Docket.tsx:617`）。

### 联单分段 (DocketSection)
- **Style:** 一条 `padding: 6px 16px` 的带子，底为 `0.035` 墨洗，上下各一条发丝线，标题 11.5px/700，右侧挂等宽读数（如 `210 × 297`、`纠错 M`、`3 错 · 1 警`）（`src/components/Docket.tsx:146-168`）。
- **分段:** 规格 / 标题 / 二维码 /（批量时）数据 /（有问题时）体检——体检分段只在有 issue 时出现（`src/components/Docket.tsx:580-598`）。
- **Footer:** 工单底部固定一行：1.5px 墨线分界 + `0.02` 墨洗，左侧一句「参数改动即时重排印张，没有「应用」这一步。」（10.5px 次级墨），右侧「恢复默认」（`src/components/Docket.tsx:603-621`）。

### 状态行 (StateLine + LineMark)
- **Style:** 应用底部的通栏：`padding: 6px 14px`、上沿发丝线、纸白底、10px 间距，左侧线型标记（默认宽 34px、高 12px），右侧 11px 等宽文字（`src/components/StateLine.tsx:68-81`）。
- **States:** 空闲时显示当前规格读数（如 A4 · 300 DPI 时的 `2480 × 3508 px · 8 px/模块 · 纠错 M`，次级墨）；出片中显示动作与进度（`付印 PDF 3/12`，点划线）；完成显示文件名 / 页数 / 时间（双线）；有提醒则换虚线（`src/components/StateLine.tsx:56-89`、`src/App.tsx:181-185`）。
- **Error tail:** 出错时在行尾补一句「· 导出失败：{原因}」，11px、墨黑，不换颜色（`src/components/StateLine.tsx:84-86`）。

### 批量数据表 (BatchGrid)
- **Style:** 表头带 `padding: 6px 14px` + `0.035` 墨洗，下沿发丝线；列头行下沿换 1.5px 墨线；表体 12px，单元格只用发丝线分隔（`src/components/BatchGrid.tsx:72-116`，`:80`、`:108`、`:104`）。
- **Columns:** 序号（宽 68px、右对齐）+ 标题（`flex: 1`，最小 110px）+ 内容（`flex: 2`，最小 140px）；序号与标题走界面字体，内容走等宽（`src/components/BatchGrid.tsx:56-60`、`:113`）。
- **Signature readout:** 表头右侧实时报「第 X–Y 条 / 共 N 条」（10.5px 等宽），数值来自 DataGrid 的渲染上下文，是真实可视范围而不是估算；拿不到可视范围时退回「共 N 条」（`src/components/BatchGrid.tsx:68`、`:83-86`、`:20-37`）。
- **Current row:** 内描边 `1px #101010` + `0.05` 墨洗 + 单元格加粗 600，与印张预览联动（`src/components/BatchGrid.tsx:115-116`）。
- **Density:** `density="compact"`、隐藏页脚、关闭列菜单与改宽（`src/components/BatchGrid.tsx:93-97`）。

### 批量数据源 (BatchSource)
- **Style:** 与联单分段同构的一条带子（`padding: 6px 16px` + `0.035` 墨洗 + 上下发丝线），三个小号描边按钮：导入 CSV / 下载示例 / 清空数据（`src/components/BatchSource.tsx:44-87`）。
- **Warnings:** 提醒条目挂在一条 `1px dashed rgba(16,16,16,0.34)` 的左边界里，最多显示 4 条，其余折成「还有 N 条…」（`src/components/BatchSource.tsx:113-121`、`:120`）。虚线在这里表达「提醒」，与状态行的词汇同源。

### 印张台面 (PressSheet)
- **Stage:** 台面灰底、居中、内边距 22px，四角套准十字以 `inset: 6px` 钉住（`src/components/PressSheet.tsx:189-245`，`:198-199`、`:203`）。台面按内容框测量（`clientWidth` 减去左右内边距，`:45-53`），印张栅格再叠 `maxWidth / maxHeight: 100%` 兜底——任何量测误差表现为整体缩小，绝不裁切（`:225-226` 的注释与取值）。
- **Ruler:** 紧贴印张左、上两边，22px 宽，按当前每毫米像素现算刻度（`src/components/PressSheet.tsx:219-231`）。
- **Paper:** 纸白、直角、唯一允许的投影；画布 `inset: 0` 绝对定位并以 `key={signature}` 重挂，每次重排触发一次 180ms 上墨动效（`src/components/PressSheet.tsx:232-242`，`:238`、`:241`）。
- **Readout Strip:** 六格读数（印张 / 分辨率 / 二维码 / 标题 / 版心 / 内容），每格字段名 10px、数值 11px 等宽、不换行（`src/components/PressSheet.tsx:140-147`、`:247-267`）。二维码一格在内容为空时显示「占位（内容为空）」（`src/components/PressSheet.tsx:184-187`）。

### 印件上的标记（导出件，不是屏幕辅助线）
- **裁切标记:** 四角、长 `min(5mm, 页边距 × 0.5)`、厚 `max(1px, DPI/600)`、与版心相距 `max(2 厚, 页边距 × 0.22)`；页边距不足 4mm 时自动忽略并报警（`src/lib/render.ts:263-277`、`:400`）。裁切标记默认打开，色标条与页边距参考虚线默认关闭（`src/state/labelStore.ts:35`），勾选后真的会印进文件（`src/components/Docket.tsx:533-560`）。
- **色标条:** 8 格、每格 3.5mm、高 `min(2.6mm, 页边距 × 0.42)`，上沿一条 `0.85` 墨色细线，右侧接一串真读数（`210×297mm · 300DPI · 模块8px · 33模块 · 纠错M`，字号 5pt）；页边距不足 6mm 时忽略并报警（`src/lib/render.ts:289-321`、`:397`）。
- **页边距参考虚线:** 参考蓝虚线标出版心边界（`src/lib/render.ts:279-284`）。
- **占位框:** 内容为空时二维码位置画虚线方框而不是留白或抛错（`src/lib/render.ts:135-146`）。

### 动效
全站只有一个动效：印张上墨。印张每次重排（`key` 变化）都以 180ms 的 `cubic-bezier(0.16, 1, 0.3, 1)` 从 `opacity: 0.42 / blur(0.6px)` 收到 `opacity: 1 / blur(0)`，`both` 填充（`src/index.css:80-94`、`src/components/PressSheet.tsx:241`）。它模拟印刷机压下时的一次上墨，给「参数已生效」一个物理信号——因为这个界面没有「应用」按钮，改动必须自己被人看见。`prefers-reduced-motion: reduce` 下该动效被完全关闭（`src/index.css:96-100`）；此外没有任何过渡、变换或滚动动画被定义。

## Do's and Don'ts

### Do:
- **Do** 用 1px 发丝线分层（`rgba(16,16,16,0.16)`）、1px 强线描边控件（`0.34`）、1.5px 墨线只画三条单据边界。
- **Do** 让每个参数都长成「字段名 : 值」的一格（`96px` 字段列 + 值列），新参数先问它属于哪一段（规格 / 标题 / 二维码 / 数据 / 体检）。
- **Do** 把数字写成等宽（`Cascadia Mono` 栈）并带上单位：`mm`、`DPI`、`pt`、`模块`、`倍`。
- **Do** 用四种线型表达状态（实线 / 点划线 / 双线 / 虚线），需要图形时优先加一条线而不是一个图标。
- **Do** 给选中态用反白（墨黑底 + 纸白字）或内描边，让灰度打印照样分得清。
- **Do** 保留键盘焦点环 `2px solid #0093d0` + `1px` 偏移——青色的这一处用途不可省略。
- **Do** 让参数改动即时生效并让印张上墨一次；破坏性动作放到工单底部单独一行。
- **Do** 在 `prefers-reduced-motion: reduce` 下关掉动效（唯一动效已就关）。
- **Do** 批量表头钉住可见范围读数「第 X–Y 条 / 共 N 条」，拿不到范围时退回「共 N 条」，用真实的渲染上下文而不是估算。
- **Do** 把预览与导出走同一条渲染路径、同一份毫米 + DPI 参数：屏幕上看到的就是打印出来的。

### Don't:
- **Don't** 使用任何圆角（`borderRadius` 必须为 0，包括拇指、复选框、提示条、滚动条）。
- **Don't** 做卡片：不要加第二层纸、不要嵌套容器；分区只用发丝线 + 一档墨洗（`0.02 / 0.035 / 0.04 / 0.05`），再深的底意味着它是实底墨黑控件。
- **Don't** 加第二个投影。唯一允许的投影属于看版台上的印张；悬停、聚焦、选中一律靠线型或底色，不靠抬高。
- **Don't** 给状态上色：错误 / 提醒 / 进行中 / 完成都只用线型加文案前缀，连调色板的 `error` 也是墨黑（`src/theme.ts:40-42`）。
- **Don't** 把青 / 品红 / 黄用作文字色、背景色或边框色——它们只做标记（套准十字色版臂、焦点环、选中底色、色标条）。
- **Don't** 发明新的墨色 hex 或新的墨洗档位；需要新的中间调就从 `#101010` 的既有 alpha 里取。
- **Don't** 引入网络字体、图标字体或位图插图；界面唯一的图形是 SVG 刻线（刻度尺、套准十字、线型标记）。
- **Don't** 给界面做做旧纹理、做旧纸纹或引用旧字形——纸白 + 墨黑要停在现代工单的克制上（决策 0001 的后果与风险一节明写了这条）。
- **Don't** 用大写变形或加字距来「强调」文字（`textTransform: none`、`letterSpacing: 0`），强调靠字重 600 / 700 与墨色浓度。
- **Don't** 引入 theme 里未被消费的字号变体（`h1 / h2 / h3 / body1 / body2 / caption` 当前没有任何界面在用），界面字号只用八级 ramp 与 `sx` 显式值。
- **Don't** 加「应用」按钮或任何待提交状态：参数即时重排是这个产品的机制本身。
- **Don't** 把「恢复默认」挪回参数区中间，或去掉它旁边的说明。
- **Don't** 让参数区或读数条把印张挤掉：窄屏按优先级塌缩，印张与导出按钮永远在场。
