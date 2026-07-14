# STATUS

## 🚫 功能冻结令 / FEATURE FREEZE（2026-07-09，置顶生效）

**即刻起至 P0 真机四场景验收通过前，本仓库冻结一切新功能开发**，包括 Action Manifest 的后续扩展（能力编辑器、运行时意图注册、传感器订阅模型等全部暂停）。

仅允许：

- 修 bug
- 验收相关的脚本与文档

已完成的 Action Manifest 代码（`lib/action-manifest/`、`manifest:validate` CLI、10 个测试）**保留但冻结**。

解除条件：按 `docs/REAL_HARDWARE_ESP32.md` / 真机验收清单完成四场景验收（executed / angle 越界拦截 / 距离互锁拦截 / 传感器缺失拦截），四份审计日志存档。

> FEATURE FREEZE: no new features until the P0 four-scenario real-device
> acceptance passes. Bug fixes and acceptance-related scripts/docs only.
> Completed Action Manifest code is retained but frozen.

---

## 当前状态（2026-07-11 更新）

- 版本：v0.2 close-out。v0.3 软件项已完成（LLM 编译器接线、REAL HARDWARE 只读面板、一键烧录待硬件）。
- **冻结令修订（2026-07-11，所有者指示）**：真机接入易用性（零配置检测/一键烧录/诊断建议）纳入允许范围；六条安全不变量与验收 DoD 不变。
- 零配置接入：REAL HARDWARE 面板新增“自动检测”——扫描全部串口→只读探测识别固件（diagnose_hardware，旧固件回退 read_distance）→显示版本/传感器/设备时钟状态→给出中文修复建议（`lib/hardware/SetupAdvisor.ts`，与排障文档同源）→无阻断项自动连接。
- 一键烧录：`npm run hardware:flash -- --port COMx`。预编译 ESP32-S3 镜像入库（`firmware/prebuilt/`，sha256 校验后才写入）；esptool 自动发现（PATH/python -m/Arduino15），找不到给安装与 IDE 回退指引。
- audit 3.1 ✅：transport 协议级错因（malformed/unmatched/oversized）随通信失败进入 adapter 失败详情与审计，超时不再无差别。
- 新增：`npm run test:virtual-loopback` — 虚拟串口全链路 e2e（真 transport/真协议/真 ticket → 固件仿真器），覆盖四场景 + legacy 固件无 deviceMs，已接入 verify 链。host 侧验收路径已预先证明，真机失败可直接归因固件/接线/供电。
- 新增：验收操作卡 `docs/acceptance/OPERATOR_CARD.md`（单页，前置检查/命令/判定/存证/速查）。
- verify 链：全绿。real-hardware 安全不变量测试 **37/37**（audit 2.1 四条 + 2.2 五条 + 1.1 两条 + transport 硬化三条 + 诊断/安全元数据若干）；app + electron typecheck 绿；全部 runner/编译型套件绿。（沙盒内 Next 生产构建因 powershell 清理脚本跳过，本机 `npm run build` 补认一次。）
- 固件：`firmware/esp32-realitywarden/esp32-realitywarden.ino` v0.1.4 / 协议 4：`deviceMs`（audit 2.2）+ 只读诊断命令 `diagnose_hardware` / `diagnose_gpio_loopback` + `echoDurationUs`。**验收前必须重刷此版**，否则旧固件不发 deviceMs，actuation 被 `device_timestamp_unavailable` 拦（预期行为）。
- 新增只读诊断 CLI：`npm run hardware:diagnose -- --port COMx`（永不驱动舵机；`--loopback` 可做 GPIO5→GPIO4 接线自检）。排障见 `docs/REAL_HARDWARE_ESP32.md` Troubleshooting（充电宝休眠/共地/S3 双串口/毛刺读数/分压等 6 类实测故障）。

### 安全自审修复进度（报告：`docs/security/2026-07-09-invariant-audit.md`）
- **2.1 传感器互锁绑定进能力声明** — ✅ 完成（commit `a5a7f6e`）。互锁要求上移为 `HardwareCapabilityLimit.requiredSensorInterlocks`（权威），调用方传空策略无法再绕过；覆盖只能收紧、更松显式拒 `invalid_interlock_override`。
- **2.2 设备侧时间戳 + 冻结值检测** — ✅ 完成（commit `37df0d4`）。缺 deviceMs ⇒ actuation blocked（`device_timestamp_unavailable`，无 silent fallback）；`StuckValueDetector`（N=5，值卡住+时钟不动才判 frozen）；`sensor_frozen` 不可 override、须显式 reset。
- **1.1 execute()/send() 结构性封装** — ✅ 完成（本次提交）。方案 B+ 双层：`lib/hardware/internal/actuation.ts` 的 gate 私有 ACTUATION_TICKET（unique symbol，index 不导出，ESLint 禁止外部 import）+ 运行期权威层——`SerialEsp32Transport.send()` 直接拒绝 actuation 帧（`actuation_requires_gate`），`sendActuation()` 校验 ticket（`invalid_actuation_ticket`），adapter 同样校验（防御纵深）。持有 adapter/transport 引用也无法发出 actuation 帧，"结构性单一通路"名副其实。只读命令（read_distance/diagnose_*）不受影响。
- **x.1 / x.2 transport 硬化** — ✅ 完成（本次提交）。接收缓冲有界（oversized line 丢弃并记 protocolError）、重复 pending id 显式拒绝、requestTimeoutMs 构造期校验。
- **附带收紧**（本次提交）：SafetyMonitor 增加 nowMs 非有限拒绝、override 去重与阈值校验、传感器类型/单位绑定校验（`sensor_type_mismatch`）、设备/主机时间戳非法与未来时间拒绝；中值读数取窗口内最旧时间戳（保守），StuckValueDetector 窗口参数校验。
- 剩余 P2（2.3/3.1/4.1/5.2 + 4.2 文档化）— 归入"真机验收后处理"，冻结不动。

### UI
- UI 审查报告 `docs/ui/2026-07-11-ui-audit.md`；冻结期可修的第 1 批（重叠/截断/去重/i18n）已修复并提交（`12221af`）；信息架构重构留待验收后。

## 下一步

1. **（你）本机重刷固件 → 跑真机四场景验收**：`npm install serialport` 一次 → `npm run hardware:demo -- --port COMx`（场景 1+2）→ `--scenario 3`（手挡 <10cm）→ `--scenario 4`（拔传感器）。四份审计日志 JSON 存档 = DoD 证据。命令与接线详见 `真机验收清单.md` / `docs/REAL_HARDWARE_ESP32.md`。
2. **验收通过 → 冻结令解除**，依次解锁：删 3 个 `@deprecated` 旧 adapter → 一键烧录 MVP → UI 真机执行路径 → v0.4 自定义动作（能力编辑器 + 意图注册，草案 `docs/ACTION_MANIFEST_DRAFT.md` 已批）。
3. 冻结期内仍可做的软件活（若需要）：audit 1.1 轻量修（改 bug 范畴，改安全层须逐条批准）；虚拟串口回环 e2e；验收操作卡。

## 待决策事项

- **audit 1.1 方案**：execute()/send() 改模块私有还是 gate 专属 token？（未出方案，等你说要不要现在做）
- **未推送 commit**：本会话所有提交需你本机 `git push`（sandbox 无外网）。截至归档，本地领先 origin 的提交见 `git log`；如遇 push 被拒先 `git pull --rebase`。
- **P2 批量处理时机**：确认全部留到验收后，还是挑几条随手清。

---

*本会话到此归档。恢复上下文：读本文件 + `docs/security/2026-07-09-invariant-audit.md` + `项目健康度报告.md`。*
