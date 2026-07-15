# STATUS

## ✅ 持续成品开发令 / CONTINUOUS PRODUCT DEVELOPMENT（2026-07-14，所有者置顶生效）

**不再以真机四场景验收作为继续开发、功能解锁或成品交付的前置条件。** 按路线图持续开发到软件成品；真机验收仅作为可选的硬件证据，不得再次阻塞 UI、运行时、Action Manifest 或发布工程。

每个功能单元仍必须遵守：

- 六条安全不变量只能收紧、不能放宽；真实执行默认拦截与证据锁不拆。
- `AGENTS.md` 的定向验证 + `npm run verify` 全绿后才提交。
- 提交按功能单元拆分，提交信息写明验证结果。

> OWNER OVERRIDE: physical acceptance is optional evidence, never a development gate.
> Continue implementation to product completion while all automated safety and product gates stay green.

---

## 当前状态（2026-07-14 更新）

- 版本：**v0.5.0 Public Alpha 发布候选**。v0.3 软件项、v0.4 Action Manifest/动作库/3D 禁区与 v0.5 手册/PDF simulation-only 双重审核闭环均已完成。
- **持续开发令（2026-07-14，所有者指示）**：取消真机验收前置条件，持续开发到软件成品；六条安全不变量、默认拦截和自动验证门禁不变。
- **Windows 安装包 v0.5.0 ✅**：`npm run desktop:pack` 已生成 `release/RealityWarden-0.5.0-Setup.exe`（NSIS x64，186429876 bytes / 177.79 MiB，SHA256 `85761D9A4A25B6A24DDEA0791DC81063311FD3EE44044F3FD08003450F58842C`）。产物包含 `dist-electron-runtime` 同源安全链、Next 生产运行时、手册/PDF 导入 UI、固定 pdfjs 运行时、`firmware/prebuilt` SHA256 配对与 3 个 Windows serialport 原生绑定；asar/unpacked/品牌资源检查、exe FileVersion/ProductVersion 0.5.0、未安装态 renderer smoke 与打包后产品设计验收矩阵均通过。`desktop:pack` 现会在验包后自动执行上述门禁。
- **UI 真机执行路径 ✅（成品主线）**：REAL HARDWARE 面板新增“真机执行”区。主进程运行时 require `dist-electron-runtime`（build-electron 同时编译根项目）——与 CLI/测试**同一份**编译后安全链（采样→保守中值→SafetyMonitor→gate→ticket→transport），ipc 层零协议复制、零手搓 actuation 帧（desktop 回归断言此契约）。执行默认 `real_execution_locked`：`docs/acceptance/evidence/` 集齐 4 份验收 JSON 才解锁（或 ORS_REAL_EXECUTION=enabled 台架督导模式），且每次执行需 UI 显式勾选确认。结果带 executionMode=real_hardware + hardwareSignalSent + 审计。
- **v0.4 自定义动作 ✅（Action Composer）**：顶栏“自定义动作”打开可视化编辑器——基元步骤（能力/目标/速度/力度下拉）+ 安全包络选择，实时 `validateActionManifest` 校验（越权包络拒绝不收窄、内建意图重名拒绝、未知目标拒绝）；保存进工作区文件（加载时重新校验，非法即拒并提示）；“运行（仿真）”经 `expandManifestToTaskDsl` 展开为基元 TaskDSL，走与任意指令**完全相同**的运行时安全管线（LocalRuntime 新增 `manifest` 编译器来源，审计如实标注，绝不伪装成 llm/rules）。
- **v0.4 动作库 JSON ✅**：Action Composer 支持严格版本化的 `realitywarden.action-library` 导入/导出。导入逐条重新执行权威 `validateActionManifest`，任一非法动作整包原子拒绝；重复 ID、已有动作覆盖、未知包字段均显式拒绝，不做静默覆盖或收窄放行。
- **v0.4 三设备参考 recipe ✅**：Robot Arm / Smart Light / Camera Sensor 各有可载入参考动作；Action Composer 按当前 profile 初始化基元并一键载入匹配 recipe，载入前仍执行权威校验。Manifest 新增精确 `device_type` 匹配与 `value` 默认拒绝策略；智能灯仅允许 boolean 开关、0–100 有限亮度及声明颜色，参数完整保留到 TaskDSL/语义执行。Action Manifest 套件由 15 项增至 **18 项**，覆盖跨设备导入、恶意参数及三 recipe 安全/语义执行。
- **v0.4 3D 禁区编辑 ✅**：3D Workspace 将选中设备的 `forbidden_zones` 渲染为红色空间标记；编辑模式基于 profile `known_targets` 显示候选区，可点击 3D 标记或列表切换。修改复用 `updateWorkspaceDevice`，立即废弃旧报告、回放和 Workspace Validation；Runtime/Safety 仍消费同一份 constraints，未增加执行旁路。
- **v0.5 手册/PDF 本地提案、Virtual Lab 二次门与动作安装三次门 ✅**：File → Import Device Manual 支持文本层 PDF/Markdown/文本，经本地 Ollama 生成严格 DeviceProfile + Action Manifest 草案；原文、SHA-256、模型与原始输出随项目保留。来源对照/JSON/原始输出三视图与真实语义 3D 模板预览明确标出非厂商 CAD。首次人工复核只保存 `simulation_only` 提案；重开后须第二次确认来源权利与几何限制，才生成 `real_device_enabled:false` 的用户仿真资产并加入 Workspace。启用不会自动安装动作；只有当前精确选中该仿真档案时，才能进入 Action Composer 查看来源摘要、基元、包络、传感器和冲突，并经第三次独立确认复制所选动作。提交点重新验证记录和 Manifest，已有 ID/重复/未知/篡改整批拒绝且不覆盖，不产生 Adapter 关联或真实权限。编辑提案会移除旧仿真实例并要求重新启用；加载时模板缺失/类型错配/启用标记篡改会整条拒绝且移除孤儿设备，不静默回退。记录始终固定 `supported_adapters:['simulator']`，能力不因模板扩大。弹窗在 1180×720 / 1440×900 视觉检查无截断，Three.js 标签不再穿透，具备 Escape/焦点圈闭。恶意提取、二次门与动作安装回归 **21/21**。
- **旧 Adapter 清理 ✅**：确认 `RealDeviceAdapter.ts`、`MockDeviceTransport.ts`、`DeviceTransport.ts` 零生产引用后删除。Virtual Lab 继续由 `SimulatorAdapter + AdapterInterface` 承载；真机契约升级为 `HardwareExecutionGate` 唯一签发私有 ticket、`Esp32DeviceAdapter` 强制验票、`RealDeviceTransport.sendActuation` 分离裸发送，相关源码断言同步收紧，文档不再宣传可自由调用的通用真机 AdapterInterface。
- 零配置接入：REAL HARDWARE 面板新增“自动检测”——扫描全部串口→只读探测识别固件（diagnose_hardware，旧固件回退 read_distance）→显示版本/传感器/设备时钟状态→给出中文修复建议（`lib/hardware/SetupAdvisor.ts`，与排障文档同源）→无阻断项自动连接。
- 一键烧录：`npm run hardware:flash -- --port COMx`。预编译 ESP32-S3 镜像入库（`firmware/prebuilt/`，sha256 校验后才写入）；esptool 自动发现（PATH/python -m/Arduino15），找不到给安装与 IDE 回退指引。
- audit 3.1 ✅：transport 协议级错因（malformed/unmatched/oversized）随通信失败进入 adapter 失败详情与审计，超时不再无差别。
- 新增：`npm run test:virtual-loopback` — 虚拟串口全链路 e2e（真 transport/真协议/真 ticket → 固件仿真器），覆盖四场景 + legacy 固件无 deviceMs，已接入 verify 链。host 侧验收路径已预先证明，真机失败可直接归因固件/接线/供电。
- 新增：验收操作卡 `docs/acceptance/OPERATOR_CARD.md`（单页，前置检查/命令/判定/存证/速查）。
- **v0.4 传感器 polling/subscription ✅**：`DistanceSensorPollingService` 持续生成可订阅、不可由订阅者篡改的传感器证据；失败读立即发布空证据，不复用 last-good；设备时钟倒退与冻结值显式锁存且只能手动 reset。`HardwareActionSequenceRunner` 在每个基元前取得新 generation 并重新经过 `HardwareExecutionGate`，首个 blocked/failed/cancelled 即终止，后续零帧。桌面 REAL HARDWARE 路径已接入该链，未新增 ticket 或旁路。
- verify 链：全绿。real-hardware 安全不变量测试 **43/43**（新增 polling 失败清空、设备时钟倒退锁存、互锁变化/传感器丢失中断多步动作并保持零后续帧；另含 audit 4.1/4.2、2.3/5.2、2.1、2.2、1.1、transport 硬化）；app + electron typecheck 绿；全部 runner/编译型套件绿。
- 固件：`firmware/esp32-realitywarden/esp32-realitywarden.ino` v0.1.4 / 协议 4：`deviceMs`（audit 2.2）+ 只读诊断命令 `diagnose_hardware` / `diagnose_gpio_loopback` + `echoDurationUs`。**验收前必须重刷此版**，否则旧固件不发 deviceMs，actuation 被 `device_timestamp_unavailable` 拦（预期行为）。
- 新增只读诊断 CLI：`npm run hardware:diagnose -- --port COMx`（永不驱动舵机；`--loopback` 可做 GPIO5→GPIO4 接线自检）。排障见 `docs/REAL_HARDWARE_ESP32.md` Troubleshooting（充电宝休眠/共地/S3 双串口/毛刺读数/分压等 6 类实测故障）。

### 安全自审修复进度（报告：`docs/security/2026-07-09-invariant-audit.md`）
- **2.1 传感器互锁绑定进能力声明** — ✅ 完成（commit `a5a7f6e`）。互锁要求上移为 `HardwareCapabilityLimit.requiredSensorInterlocks`（权威），调用方传空策略无法再绕过；覆盖只能收紧、更松显式拒 `invalid_interlock_override`。
- **2.2 设备侧时间戳 + 冻结值检测** — ✅ 完成（commit `37df0d4`）。缺 deviceMs ⇒ actuation blocked（`device_timestamp_unavailable`，无 silent fallback）；`StuckValueDetector`（N=5，值卡住+时钟不动才判 frozen）；`sensor_frozen` 不可 override、须显式 reset。
- **1.1 execute()/send() 结构性封装** — ✅ 完成（本次提交）。方案 B+ 双层：`lib/hardware/internal/actuation.ts` 的 gate 私有 ACTUATION_TICKET（unique symbol，index 不导出，ESLint 禁止外部 import）+ 运行期权威层——`SerialEsp32Transport.send()` 直接拒绝 actuation 帧（`actuation_requires_gate`），`sendActuation()` 校验 ticket（`invalid_actuation_ticket`），adapter 同样校验（防御纵深）。持有 adapter/transport 引用也无法发出 actuation 帧，"结构性单一通路"名副其实。只读命令（read_distance/diagnose_*）不受影响。
- **x.1 / x.2 transport 硬化** — ✅ 完成（本次提交）。接收缓冲有界（oversized line 丢弃并记 protocolError）、重复 pending id 显式拒绝、requestTimeoutMs 构造期校验。
- **2.3 / 5.2 通用数值执行边界** — ✅ 完成。`HardwareCapabilityLimit.argumentLimits` 对每项能力强制显式声明；SafetyMonitor 通用校验声明名称、有限且有序的 min/max、参数类型与范围，并默认拦截未声明的数值 actuation 参数；adapter 复用同一声明做第二层物理限位，所有越界只拒绝不钳制。真机安全套件增至 38 项，conformance 增加强制源码断言。
- **4.1 / 4.2 诚实执行证据** — ✅ 完成。保留兼容且保守的 `hardwareSignalSent`，新增 `not_sent / attempted_unconfirmed / device_acknowledged` 三态证据并在审计层拒绝布尔/三态矛盾；SG90 成功仅记 `command_acknowledged_open_loop` 与 `physicalOutcomeVerified:false`，REAL HARDWARE 面板一步显示歧义发送和开环限制。真机安全套件增至 39 项，Desktop/Conformance 断言同步收紧。
- **附带收紧**（本次提交）：SafetyMonitor 增加 nowMs 非有限拒绝、override 去重与阈值校验、传感器类型/单位绑定校验（`sensor_type_mismatch`）、设备/主机时间戳非法与未来时间拒绝；中值读数取窗口内最旧时间戳（保守），StuckValueDetector 窗口参数校验。
- 安全自审列出的 P1/P2 已全部收口；新增硬件能力必须继承同等或更强的默认拦截、ticket 与证据语义。

### UI
- UI 审查报告 `docs/ui/2026-07-11-ui-audit.md`；第 1、2 批（重叠/截断/去重/i18n）已修复；信息架构与视觉一致性现为最高优先级。
- **C3 右侧证据栏 ✅**：Runtime Governor 与审计证据合并为 `Audit & Governor`，设备配置拆入 `Device Inspector` Tab；设备选择变化一步打开 Inspector，新运行/新证据一步回到审计；`REAL HARDWARE` 始终位于 Tab 之外并保留独立黑黄危险边界。仅重组呈现与状态导航，未修改审计、安全门或真实执行逻辑。
- **E1/E2/E3 设计系统基础 ✅**：`app/globals.css` 与 Tailwind 提供 background/surface/border/text/semantic tokens，仿真与 REAL HARDWARE 独立配色；统一 4px 间距规则、11/12/13/15/18px 字号层级、键盘 focus ring、浮层 96% 不透明度/8px blur/单一阴影，工程规范见 `docs/ui/DESIGN_SYSTEM.md`。旧组件通过兼容别名渐进迁移，不涉及业务状态。
- **C2 CommandDock ✅**：AI Command 默认面仅保留输入、唯一 Run/Stop、单一主状态和当前目标；LLM 来源、诊断、不可运行目标恢复路径、starter commands 与 Quick Start 详情移入可展开二级区。所有原能力保留，移除引导内容中的重复 Run；提交/停止回调与运行时安全管线未变。
- **C1 左侧导航 ✅**：Device Navigator 与 Asset Library 拆为显式 Tab；Device Type / Profile / Scenario 归设备导航，资产搜索/拖放/添加归资产库，Public Alpha 支持说明随设备配置折叠，静态 Developer Preview 独立放入 Build boundaries。语言设置移至全局顶栏；左栏在 1180px 为 240px、1280px 起为 280px，关键能力不隐藏。
- **C4 AppHeader ✅**：顶栏拆为 `AppHeader` / `FileMenu`，按项目身份与预检、文件操作、Quick Start/自定义动作、唯一运行结果、导出与语言分组；高度统一为 48px，FileMenu 浮层复用设计系统。Run/Stop 不进入顶栏，仍只属于 CommandDock。
- **可访问恢复第一批 ✅**：操作通知按严重度使用 `status/polite` 或 `alert/assertive`，错误保持到人工关闭；损坏自动保存提供显式清除且不改当前工作区。Action Composer 具备可访问名称、Escape、Tab/Shift+Tab 圈闭与触发器回焦；所有模态统一抑制背景和 Three.js HTML 穿透。3D 世界标签被约束在工作区控件下层，不再覆盖 CommandDock。路由/全局/3D 崩溃面提供局部恢复 + 完整重载，并不再从 UI 异常伪造“硬件未发送”结论。新增 `test:accessibility` 接入 verify；1180×720 / 1440×900 动作编辑器实测完整，键盘路径通过。
- **文件恢复与剩余导入模态 ✅**：Project Open / Save / Save As、Lab Report、Adapter Package 与所选资产配置导出均捕获桌面 IPC、文件系统和浏览器下载失败；错误通知保持可见并提供原操作重试，浏览器 Open 恢复入口允许重新选择同名文件。资产导入获得 dialog/Escape/Tab 圈闭，资产与手册导入均稳定回焦到仍可见的 File 菜单按钮；1180×720 与 1440×900 浏览器验收完整，控制台零 warning/error。未修改导入校验、安全逻辑或执行语义。

- **全局键盘与高对比度收口 ✅**：Device Navigator、Evidence Sidebar、手册审阅三组 Tab 统一 roving focus，支持方向键/Home/End，并补齐 Tab/Panel 关系；File 桌面菜单支持上下键、Home/End、Escape 回焦和菜单外关闭。全局 focus-visible 覆盖菜单项、链接与 summary，增加 prefers-contrast / forced-colors 兜底；REAL HARDWARE 在强制颜色下保留独立双线危险边界。未修改运行、安全、审计或真实执行语义。

- **上市收口证据链与真实 renderer smoke ✅**：`--smoke-test` 不再只等待 Next 端口，而是在隔离会话中加载真实 Electron renderer，核对 AppHeader、Device Navigator、CommandDock、唯一 Run/Stop、SIMULATION ONLY、独立 REAL HARDWARE 边界与 preload bridge；任一缺失均非零退出。`desktop:pack` 现按“验包 → first-run renderer smoke → 证据清单”顺序执行，成功后写出带安装包 SHA256/大小、BUILD_ID、源码 commit、工作树 clean/dirty 状态的 `Release-Evidence.json` 及其 SHA256，并显式不声明签名、真机验收或物理结果。新增 `test:launch-closure` 接入 verify；源码 production desktop smoke 已实跑通过。未重打包含当前用户未提交改动的发布包。

- **严格工程文件契约与自动保存隔离 ✅**：浏览器导入、Electron Open/Save 与自动恢复统一使用版本化深层契约；未知字段、非法枚举、重复/悬空设备、两份 devices 分叉、非有限数、原型污染键、超限文件及 `real_device_execution_enabled:true` 均明确拒绝，不钳制、不静默回退。损坏自动保存不再启动即删除或被当前工作区覆盖，而是隔离并等待人工清除。生产 parser/serializer 往返与恶意输入套件已接入 verify；未修改执行、安全门、审计或真机语义。

- **工程 v2 无损资产往返与耐久自动保存 ✅**：工程/工作区写格式升级为 v2，用户导入 DeviceAsset 与内嵌 GLB/GLTF 字节随 Save/Open 完整往返；v1 显式迁移且绝不伪造旧格式从未保存的模型字节。导入资产递归严格校验，未知字段不再被 Zod 静默剥离，真实 Adapter 权限、外部/临时路径、悬空引用、内建/手册资产遮蔽及超限文件均拒绝。完整 v2 工程自动保存迁入 IndexedDB，旧 localStorage 记录仅在耐久写入成功后删除；损坏与存储失败仍隔离、可见、可重试。未修改执行门、安全审计或真机语义。

- **Windows 安装生命周期闭环 ✅**：`desktop:pack` 在验包、未安装态 renderer smoke 与打包后产品设计矩阵后，于专用临时目录执行当前用户静默干净安装、安装态首启、强制断网显式规则编译器降级、原位重装、卸载载荷/登记清零与用户数据保留；发现任意既有 RealityWarden 安装登记会默认拒绝，绝不覆盖用户安装。设计验收、生命周期清单与总发布证据均带 SHA256，总证据 schema v3 仅在全部门禁通过后写出；历史版本迁移、签名与真机仍明确不在本记录声明范围。2026-07-15 实际安装包 `186429876` bytes，SHA256 `85761D9A4A25B6A24DDEA0791DC81063311FD3EE44044F3FD08003450F58842C`，完整生命周期实跑通过。
- **最终主工作台产品设计验收矩阵 ✅**：真实 Electron 生产 renderer 与打包后 `RealityWarden.exe` 均通过 1440×900 / 1180×720、中英文、Windows 125% / 150% 缩放、Action Composer / Asset Import / Manual Import 模态边界、可信键盘焦点和 forced-colors 验收。持久错误通知不再盖住 File 菜单；资产导入面板在 1180×720 保留 16px 安全边距。版本化 `Design-Acceptance.json` 及 SHA256 已成为 `desktop:pack` 的发布前门禁；未修改业务、安全、审计或真实执行语义。

## 下一步

1. **启动体验成品化**：按首席设计规格统一 Electron 冷启动、Next hydration、工作区恢复、离线降级与启动错误界面；消灭蓝白默认页/闪白，补齐缩放、双语、reduced-motion、forced-colors 与键盘恢复的可复现启动证据，不修改业务或安全逻辑。
2. **发布操作（所有者）**：可选代码签名、tag、上传安装包与 SHA256；这些外部动作不改变软件完成状态。

## 待决策事项

- **未推送 commit**：本会话所有提交需你本机 `git push`（sandbox 无外网）。截至归档，本地领先 origin 的提交见 `git log`；如遇 push 被拒先 `git pull --rebase`。
- **真机证据**：可随时补充，但不是任何软件开发、功能解锁或发布工作的阻塞项。

---

*本会话到此归档。恢复上下文：读本文件 + `docs/security/2026-07-09-invariant-audit.md` + `项目健康度报告.md`。*
