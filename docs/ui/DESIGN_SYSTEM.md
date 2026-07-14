# RealityWarden Desktop Design System

本规范约束 Electron 桌面工作台的视觉实现。它只组织呈现，不改变安全、审计、默认拦截、执行证据锁或硬件语义。

## Semantic color tokens

| Token | CSS variable | HEX / value | 用途 |
| --- | --- | --- | --- |
| background | `--color-background` | `#090A0C` | 应用与 3D 工作区底色 |
| surface | `--color-surface` | `#121418` | 常驻面板、工具栏 |
| surface-raised | `--color-surface-raised` | `#1C1E24` | 选中项、嵌套控件、悬停 |
| border | `--color-border` | `#2A2D35` | 默认分隔线 |
| border-strong | `--color-border-strong` | `#3A3F4A` | 激活控件与强边界 |
| text-primary | `--color-text-primary` | `#E5E7EB` | 标题、正文、关键值 |
| text-secondary | `--color-text-secondary` | `#9CA3AF` | 标签、说明 |
| accent | `--color-accent` | `#38BDF8` | 焦点、选择、普通主操作 |
| success | `--color-success` | `#22C55E` | executed / completed |
| warning | `--color-warning` | `#FACC15` | warning，仅状态语义 |
| danger | `--color-danger` | `#F43F5E` | blocked / destructive |
| simulation | `--color-simulation` | `#38BDF8` | 仿真模式边界与标签 |
| real-hardware | `--color-real-hardware` | `#F59E0B` | 真实硬件危险边界与标签 |

`simulation` 与 `real-hardware` 不得互换，也不得仅靠文案或相近颜色区分。状态色只表达状态，不用于大面积装饰。

## Spacing and sizing

使用 Tailwind 默认的 4px 基线：`1=4px`、`2=8px`、`3=12px`、`4=16px`、`6=24px`、`8=32px`。面板内边距默认 12px，密集工具条 8px；并列控件间距 8px，标签与值间距 4px。禁止引入非 4px 倍数的布局间距，1px 边框除外。

## Typography

| Size | Utility | 用途 |
| --- | --- | --- |
| 11px | `.rw-text-meta` | 时间戳、ID、次级审计元数据；不得用于主要按钮或正文 |
| 12px | `.rw-text-label` | 控件标签、紧凑表格、状态辅助文案 |
| 13px | `.rw-text-body` | 默认正文、输入与按钮 |
| 15px | `.rw-text-title` | 面板标题、当前目标 |
| 18px | `.rw-text-heading` | 页面级/关键结果标题，少量使用 |

## Radius, focus, overlays, shadow

- 控件圆角 `4px`（`--radius-control`），浮层/独立卡片最大 `6px`（`--radius-panel`）。结构面板保持直角。
- 键盘焦点统一为 `2px rgba(56,189,248,.72)` 外环；不得用 `outline: none` 后不提供替代焦点。
- 浮层统一使用 `rgba(18,20,24,.96)`、`8px` backdrop blur 和 `0 10px 30px rgba(0,0,0,.42)`。常驻面板不使用模糊或阴影。
- `.rw-floating-panel` 是唯一通用浮层外观；禁止组件自定义另一套透明度、阴影或 blur。

## Safety presentation contract

- `Run` / `Stop` 只存在于 AI Command Terminal。
- 一次运行只显示一个主状态：`idle`、`running`、`executed`、`blocked` 或 `unsupported`；`compiled` 是编译阶段元数据，不得与运行结果并列为主状态。
- blocked/executed 后，右侧 `Audit & Governor` 必须一步可见对应证据。
- `REAL HARDWARE` 始终位于仿真证据 Tab 之外，并带独立橙黑危险边界。

## Accessibility and recovery contract

- 信息/成功通知使用 `role=status` + `aria-live=polite`；警告/错误使用
  `role=alert` + `aria-live=assertive`，消息必须 `aria-atomic=true`。
- 错误通知不得自动消失；必须可手动关闭。可恢复错误应提供上下文操作，
  例如损坏的自动保存只能由用户显式清除，且不得改变当前工作区。
- 模态窗口必须具有可访问名称和说明、Escape 关闭、Tab/Shift+Tab 焦点圈闭，
  并在关闭后把焦点还给明确的触发器。打开任何模态时，背景和 Three.js
  HTML 标签不得穿透、接收交互或留在可见层。
- Three.js 世界标签的 z-index 必须低于 CommandDock 和工作区操作控件；
  不能在 1180×720 下覆盖命令输入或 Run/Stop。
- UI/3D 崩溃界面必须提供局部恢复和完整重载两条路径，并显示错误详情/
  digest。**不得**从 UI 崩溃推断 `hardwareSignalSent` 或声称“没有信号发送”；
  恢复后应提示用户先检查审计证据，再决定是否重试真实命令。

自动防回归入口：`npm run test:accessibility`，并已接入 `npm run verify`。
