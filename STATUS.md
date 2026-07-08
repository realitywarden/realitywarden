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

## 当前状态（2026-07-09）

- 版本：v0.2 close-out，v0.3 软件项已完成（LLM 编译器接线、REAL HARDWARE 只读面板）
- verify 链：24 套件
- 主线待办：硬件到货 → 四场景验收 → 解锁后续（删 @deprecated adapter → 一键烧录 MVP → UI 真机执行路径 → v0.4）
