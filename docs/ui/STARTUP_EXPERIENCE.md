# RealityWarden Startup Experience

本规范约束 Electron 冷启动、Next hydration 和 renderer 错误恢复的成品呈现。
它只聚合并诚实显示启动状态，不修改业务、安全、审计、默认拦截、证据锁或
真实执行逻辑。

## State ownership

| State | Owner | Presentation |
| --- | --- | --- |
| `cold_start` | Electron main | 中性深色启动壳；仅说明本地应用服务正在加载 |
| `initializing` | Electron main, 2s threshold | 说明启动时间较长；不显示虚假百分比 |
| `renderer_hydration` | Next `app/loading.tsx` | 与 Electron 相同背景、面板和中性指示器 |
| `recoverable_error` | Electron main | 保留本地错误页；Retry / Exit、折叠详情、Audit Evidence 声明 |
| renderer failure | Next error boundaries | Recover interface / Reload app、折叠详情、Audit Evidence 声明 |
| LLM offline | Main workbench | 继续由既有 LLM chip 显示规则编译器降级；不阻塞或伪装成启动失败 |

LLM 可用性不是工作台启动门。真实硬件状态也不属于启动状态；任何启动或
renderer 错误都不得推断硬件信号是否发送。

## Paint continuity

- `BrowserWindow.backgroundColor`、Electron 启动 HTML、Next 根内联样式、
  `html`、`body` 和 hydration shell 全部使用 `#090A0C`。
- BrowserWindow 初始 `show:false`，本地启动壳完成首帧后才显示。
- 启动壳不使用 `accent/simulation` 蓝色或 `real-hardware` 橙色；活动指示器
  使用 `text-secondary #9CA3AF`。
- 根文档声明 `color-scheme: dark`，禁止 `#FFFFFF`、默认链接蓝和旧
  `#0066CC` 启动按钮。
- 启动面板最大宽度 480px、四边至少 16px 安全边距；标准内边距 32×40px，
  低高度/窄视口收缩为 24px。

## Recovery contract

- 失败为 `role=alert` / `aria-live=assertive`，正常加载为 `role=status` /
  `aria-live=polite`；不渲染高频进度文本。
- 错误详情默认折叠、HTML 转义、最大高度 160px且可复制。
- Electron 启动失败可以 Retry 或 Exit；重试会先终止本次拥有的服务进程，
  重新寻找安全端口并重新启动，不接触工作区或执行状态。
- renderer 错误提供局部 Recover 与完整 Reload；恢复按钮获得初始焦点。
- 错误面板明确说明 UI 状态不能证明硬件传输结果，必须检查 Audit Evidence。

## Motion and contrast

- 默认活动条 2px 高、1.5s linear；`prefers-reduced-motion:reduce` 下完全
  静止且 `animation:none`。
- `forced-colors` 下错误边界为 double，键盘焦点使用系统 Highlight 的
  solid outline；不依赖红/黄颜色独自表达失败类型。

## Reproducible acceptance

```powershell
npm run desktop:startup-acceptance
```

该命令用真实 Electron renderer 验证 1440×900 / 1180×720、中英文、
125% / 150% 缩放、禁止色、错误详情转义、焦点、reduced-motion 和
forced-colors，并生成：

```text
release/RealityWarden-0.5.0-Startup-Acceptance.json
release/RealityWarden-0.5.0-Startup-Acceptance.json.sha256
```

`npm run desktop:pack` 会对打包后的 `RealityWarden.exe` 再执行同一矩阵，
然后才运行主工作台产品设计矩阵和 Windows 安装生命周期。
