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

- 版本：**v0.3.0 Public Alpha 发布收口**。v0.3 软件项已完成（LLM 编译器 UI、独立 REAL HARDWARE 安全边界、一键烧录）；v0.4 的 Action Manifest、动作库 JSON 与 3D 禁区编辑已提前完成。
- **持续开发令（2026-07-14，所有者指示）**：取消真机验收前置条件，持续开发到软件成品；六条安全不变量、默认拦截和自动验证门禁不变。
- **Windows 安装包 v0.3.0 ✅**：`npm run desktop:pack` 已生成 `release/RealityWarden-0.3.0-Setup.exe`（NSIS x64，165911345 bytes，SHA256 `ED01B73AA0B31EDADCA09DB326073D890FD61FC360A0503D8C8ED5505F4E0D7F`）。产物包含 `dist-electron-runtime` 同源安全链、Next 生产运行时、`firmware/prebuilt` SHA256 配对与 3 个 Windows serialport 原生绑定；asar/unpacked/品牌资源检查、exe FileVersion/ProductVersion 0.3.0 与 `win-unpacked/RealityWarden.exe --prod --smoke-test` 均通过。
- **UI 真机执行路径 ✅（成品主线）**：REAL HARDWARE 面板新增“真机执行”区。主进程运行时 require `dist-electron-runtime`（build-electron 同时编译根项目）——与 CLI/测试**同一份**编译后安全链（采样→保守中值→SafetyMonitor→gate→ticket→transport），ipc 层零协议复制、零手搓 actuation 帧（desktop 回归断言此契约）。执行默认 `real_execution_locked`：`docs/acceptance/evidence/` 集齐 4 份验收 JSON 才解锁（或 ORS_REAL_EXECUTION=enabled 台架督导模式），且每次执行需 UI 显式勾选确认。结果带 executionMode=real_hardware + hardwareSignalSent + 审计。
- **v0.4 自定义动作 ✅（Action Composer）**：顶栏“自定义动作”打开可视化编辑器——基元步骤（能力/目标/速度/力度下拉）+ 安全包络选择，实时 `validateActionManifest` 校验（越权包络拒绝不收窄、内建意图重名拒绝、未知目标拒绝）；保存进工作区文件（加载时重新校验，非法即拒并提示）；“运行（仿真）”经 `expandManifestToTaskDsl` 展开为基元 TaskDSL，走与任意指令**完全相同**的运行时安全管线（LocalRuntime 新增 `manifest` 编译器来源，审计如实标注，绝不伪装成 llm/rules）。
- **v0.4 动作库 JSON ✅**：Action Composer 支持严格版本化的 `realitywarden.action-library` 导入/导出。导入逐条重新执行权威 `validateActionManifest`，任一非法动作整包原子拒绝；重复 ID、已有动作覆盖、未知包字段均显式拒绝，不做静默覆盖或收窄放行。
- **v0.4 三设备参考 recipe ✅**：Robot Arm / Smart Light / Camera Sensor 各有可载入参考动作；Action Composer 按当前 profile 初始化基元并一键载入匹配 recipe，载入前仍执行权威校验。Manifest 新增精确 `device_type` 匹配与 `value` 默认拒绝策略；智能灯仅允许 boolean 开关、0–100 有限亮度及声明颜色，参数完整保留到 TaskDSL/语义执行。Action Manifest 套件由 15 项增至 **18 项**，覆盖跨设备导入、恶意参数及三 recipe 安全/语义执行。
- **v0.4 3D 禁区编辑 ✅**：3D Workspace 将选中设备的 `forbidden_zones` 渲染为红色空间标记；编辑模式基于 profile `known_targets` 显示候选区，可点击 3D 标记或列表切换。修改复用 `updateWorkspaceDevice`，立即废弃旧报告、回放和 Workspace Validation；Runtime/Safety 仍消费同一份 constraints，未增加执行旁路。
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

## 下一步

1. **v0.5 主线**：手册/PDF → 本地 LLM 草拟 DeviceProfile + Action Manifest，必须保留原始提取、人工复核且默认 simulation-only。
2. **成品化持续项**：继续清理评估文档陈旧语义、安装包验包与可访问性/错误恢复细节。
3. **发布操作（所有者）**：可选代码签名、tag、上传安装包与 SHA256；这些外部动作不改变软件完成状态。

## 待决策事项

- **未推送 commit**：本会话所有提交需你本机 `git push`（sandbox 无外网）。截至归档，本地领先 origin 的提交见 `git log`；如遇 push 被拒先 `git pull --rebase`。
- **真机证据**：可随时补充，但不是任何软件开发、功能解锁或发布工作的阻塞项。

---

*本会话到此归档。恢复上下文：读本文件 + `docs/security/2026-07-09-invariant-audit.md` + `项目健康度报告.md`。*
