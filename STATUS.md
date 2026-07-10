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

## 当前状态（2026-07-09 更新）

- 版本：v0.2 close-out。v0.3 软件项已完成（LLM 编译器接线、REAL HARDWARE 只读面板、一键烧录待硬件）。
- verify 链：全绿。real-hardware 安全不变量测试 **22/22**（含 audit 2.1 四条 + audit 2.2 五条）；app + electron typecheck 绿；全部 runner/编译型套件绿。
- 固件：`firmware/esp32-realitywarden/esp32-realitywarden.ino` 已含 `deviceMs` 设备侧时间戳（audit 2.2）。**验收前必须用此版重刷 ESP32**，否则旧固件不发 deviceMs，actuation 会被 `device_timestamp_unavailable` 拦（属预期行为，非硬件故障）。

### 安全自审修复进度（报告：`docs/security/2026-07-09-invariant-audit.md`，若已归档）
- **2.1 传感器互锁绑定进能力声明** — ✅ 完成（commit `a5a7f6e`）。互锁要求上移为 `HardwareCapabilityLimit.requiredSensorInterlocks`（权威），调用方传空策略无法再绕过；覆盖只能收紧、更松显式拒 `invalid_interlock_override`。
- **2.2 设备侧时间戳 + 冻结值检测** — ✅ 完成（commit `37df0d4`）。缺 deviceMs ⇒ actuation blocked（`device_timestamp_unavailable`，无 silent fallback）；`StuckValueDetector`（N=5，值卡住+时钟不动才判 frozen）；`sensor_frozen` 不可 override、须显式 reset。
- **1.1 execute()/send() 结构性封装** — ⏳ 待做（轻量修，方案未出）。当前 gate 外调用仅靠约定阻止。
- P2 项（2.3/3.1/4.1/5.2/x.1/x.2 + 4.2 文档化）— 归入下方"真机验收后处理"，冻结不动。

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
