# RealityWarden Product Design Acceptance

本矩阵是桌面软件成品设计的可复现验收契约。它验证真实 Electron renderer
的布局、交互和可访问呈现，不修改或替代安全、审计、默认拦截、证据锁和
真实硬件语义。

## Reproduce

源码生产 renderer：

```powershell
npm run desktop:design-acceptance
```

最终安装包（包含验包、打包后设计矩阵和 Windows 安装生命周期）：

```powershell
npm run desktop:pack
```

成功后生成：

```text
release/RealityWarden-0.5.0-Design-Acceptance.json
release/RealityWarden-0.5.0-Design-Acceptance.json.sha256
```

JSON 包含每项 gate、每个视口/语言/缩放的几何测量、模态边界和焦点结果，
而不是依赖人工截图结论。SHA256 companion 用于发现证据文件被改写。

## Acceptance matrix

| Gate | Required coverage | Pass condition |
| --- | --- | --- |
| Responsive layout | 1440×900、1180×720 | 文档无横向/纵向溢出；48px 顶栏；左右栏和中央工作区不重叠；CommandDock 保持可操作最小宽度 |
| Bilingual content | 中文、English | 两种语言分别跑完两个视口；可见关键按钮无裁切；REAL HARDWARE 标签和唯一 Run/Stop 保持可见 |
| Windows scaling | 125%、150% | 使用 Chromium 设备度量仿真系统缩放；所有布局约束仍通过 |
| Dialog boundaries | Action Composer、Asset Import、Manual Import | 1180×720 下四边至少 16px 安全边距；初始焦点在 dialog 内；Escape 关闭；焦点返回可见触发器 |
| Keyboard focus | 复杂模态与危险边界 | 实际可信 Tab 键事件产生可见焦点环，不以脚本 `focus()` 冒充键盘路径 |
| Forced colors | Windows high contrast equivalent | forced-colors 生效；REAL HARDWARE 保留显式双线危险边界；聚焦控件保留 solid outline |

布局测量同时断言：

- `WorkspaceViewport` 最小宽度 560px；
- `CommandDock` 最小宽度 520px，且不与左右栏相交；
- 1180px 视口左栏收缩为 240px，1440px 恢复为 280px；
- 右侧 EvidenceSidebar 保持 360px；
- REAL HARDWARE 始终位于 EvidenceSidebar 内、Tab 结构之外；
- 全页只存在一组主 Run/Stop，且属于 CommandDock。

## Recovery and overlay requirements

- 持久 autosave/file 错误通知不能自动消失，但层级低于 File 菜单与所有模态，
  因而不会阻断恢复操作。
- 资产导入旧版固定尺寸面板由全局 modal boundary 约束在视口内；在
  1180×720 下保留 16px 上下边距，不修改资产解析或导入业务逻辑。
- 所有验收失败都令进程非零退出；设计 smoke 失败不得弹出无人值守阻塞框。

## Evidence boundary

本记录证明软件 renderer 在指定矩阵中的可复现表现。它不声明代码签名、
历史版本迁移、物理设备动作结果或真机验收。真机证据始终是可选补充，绝不
作为继续开发或软件发布工程的前置条件。
