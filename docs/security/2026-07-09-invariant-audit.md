> 归档状态（2026-07-11 更新）：
> - **2.1** 传感器互锁绑定进能力声明 — ✅ 已修复（commit `a5a7f6e`）
> - **2.2** 设备侧时间戳 + 冻结值检测 — ✅ 已修复（commit `37df0d4`）
> - **1.1** execute/send 结构性封装 — ✅ 已修复（方案 B+：gate 私有 ACTUATION_TICKET + transport 运行期拒绝 actuation 帧 + ESLint 边界；详见 STATUS.md 与 `lib/hardware/internal/actuation.ts`）
> - **x.1 / x.2** 接收缓冲无上限 / 请求 id 复用 — ✅ 已修复（缓冲有界 + duplicate_request_id 显式拒绝）
> - **3.1** 协议错因不可见 — ✅ 已修复（transport 协议错误进入 adapter 失败详情与审计）
> - **2.3 / 5.2** 能力边界可缺 / 数值检查不可扩展 — ✅ 已修复（必填 `argumentLimits` + 通用有限范围校验 + 未声明数值执行参数默认拦截；adapter 同声明防御纵深）
> - **4.1 / 4.2** 发送证据细化 / 开环执行语义 — ✅ 已修复（保留 `hardwareSignalSent`，新增三态 `hardwareSignalState`；设备确认与物理到位分离，SG90 明示 `command_acknowledged_open_loop` / `physicalOutcomeVerified:false`）
> - 本报告列出的 P1/P2 修复项已全部收口；后续新增硬件能力仍须遵守同等或更强证据语义。
> - 本文件为原始自审报告归档，正文未改；解决进度以本头部与 STATUS.md 为准。

# 安全自审报告 — 六不变量攻击面分析（2026-07-09）

**性质**：只审不改。以下均为发现与分析，无任何代码改动。修复方案等你逐条批准后再动。
**范围**：核心运行时（`SafetyMonitor`、`HardwareExecutionGate`、`RuntimeAuditLog`）、Adapter（`Esp32DeviceAdapter`、`SerialEsp32Transport`、`SensorConditioning`）、固件通信路径（`esp32-realitywarden.ino` + newline-JSON 协议）。
**不在范围**：前端、CLI、Action Manifest。
**严重度**：P0 = 可绕过不变量 / P1 = 边界情况异常 / P2 = 理论风险。

总体结论：六层防护的**主干是可信的**——blocked 决策在 gate 内确无到 transport 的调用，越界三层拒绝（SafetyMonitor→adapter→固件）且均不钳制，离线不伪造成功。发现的问题集中在"**权威边界外移到调用方**"和"**新鲜度检查在 pull 模型下形同虚设**"两类。无 P0 级"当前在库内可直接绕过"的漏洞；最重的两项是 P1，均因核心把某项安全知识托付给了调用方而非自身强制。

---

## 不变量 1：单一受控通路（blocked ⇒ 零帧上线，结构性而非约定性）

### 1.1 `adapter.execute()` / `transport.send()` 是 public，绕过 gate 仅靠约定 — **P1**
`Esp32DeviceAdapter.execute()`（`lib/hardware/Esp32DeviceAdapter.ts:39`）和 `SerialEsp32Transport.send()`（`SerialEsp32Transport.ts:72`）都是公有方法。`HardwareExecutionGate` 注释声称"结构上不存在 blocked→transport 的通路"，但事实是：任何代码只要 `new Esp32DeviceAdapter(transport).execute(cmd)` 就能完全跳过 SafetyMonitor 与 gate。当前库内**只有** gate 调用 `execute`（已确认），所以是"约定性"而非"结构性"保证。攻击面：未来任意一处新代码/误用/合并回来的旧路径直接调 adapter，即绕过全部安全层。
- 影响不变量 1 的"结构性"措辞名不副实。
- 缓解现状：adapter 自身有物理限位 + 固件兜底，所以即便被直接调用，越界仍被拒；但传感器互锁（只在 SafetyMonitor 里）会被整个跳过。

### 1.2 `readDistance()` 直连 transport 不过 gate — 记录项（非缺陷）
`Esp32DeviceAdapter.readDistance()`（:102）直接 `transport.send`。这是只读能力，设计上只读不受执行锁约束（与仿真侧 read_distance 放行一致），符合预期。仅记录，不计缺陷。

---

## 不变量 2：默认拦截（信息缺失/过期/非法 ⇒ 拦截执行）

### 2.1 传感器策略由调用方提供，缺策略 ⇒ 静默放行执行 — **P1（有升 P0 风险）**
`SafetyMonitor.evaluateHardwareCommand`（`SafetyMonitor.ts:109`）的互锁循环是 `for (const policy of sensorPolicies)`。`sensorPolicies` 是**调用方传入的**。若调用方传空数组（bug、遗漏、或恶意），且命令是合法角度的 actuation，则：能力检查过、角度检查过、互锁循环零次迭代 → **返回 allowed 并真实上线**。
- 核心问题：SafetyMonitor 不"知道" esp32-servo-rig 这台设备**必须**有距离互锁；这项知识活在 demo 脚本里（`realHardwareDemo.ts:50-57`），不在权威层。
- 即"这台设备需要哪些传感器闸"是数据、由调用方装配，核心不强制。缺失被当作"无需互锁"处理，是默认放行而非默认拦截，直接抵触不变量 2。
- 为何暂列 P1 而非 P0：四场景验收脚本正确装配了策略，当前唯一调用方行为正确。但只要有第二个调用方忘记装配，场景 3/4 的保护即失效。**若无独立机制保证策略随设备强制注入，应升 P0。**

### 2.2 新鲜度检查在 pull 模型下恒不触发 — **P1**
`sensor_stale` 判定是 `nowMs - reading.timestampMs > maxAgeMs`（`SafetyMonitor.ts:117`）。但 `timestampMs` 由**主机在读取瞬间**打（`Esp32DeviceAdapter.readDistance` :96 `timestampMs: Date.now()`；demo :90 又重打一次 `timestampMs: Date.now()`）。因为主机总是在调 gate 前一刻现打时间戳，读数年龄按构造恒 ≈0ms，**`sensor_stale` 分支实际上是死代码**。
- 攻击面：真正的威胁是"传感器停更但仍返回上一帧数值"。HC-SR04 断线时 `readDistance` 返回 null（→默认拦截，安全）；但若传感器返回一个**过期但物理合理**的定值（例如固件/线路故障卡在某读数），主机照样打上 fresh 时间戳，`sensor_stale` 与 `sensor_invalid` 都不触发，该定值被当作有效读数喂给互锁。
- 根因：协议无**设备侧测量时间戳**，主机无法区分"新测量"与"重发旧值"。新鲜度语义名义存在、实际无保护。

### 2.3 `capabilityLimits` 亦为调用方数据，min/max 可为 undefined — **P2**
`SafetyMonitor.ts:97` 的角度范围检查依赖 `capability.min/max`；二者在类型上可选（`types.ts:22-23`）。调用方若传入无界限的能力条目，SafetyMonitor 的角度检查被跳过。缓解：adapter 用自己硬编码的 `ESP32_SERVO_RIG_CAPABILITIES`（0–180），固件再兜一层，所以越界仍被拒。列 P2（主限位是调用方数据、非权威，但有双层兜底）。

---

## 不变量 3：无静默回退（每次降级显式、记录、可见）

### 3.1 `lastProtocolError` 记录了但无人读 — **P2**
`SerialEsp32Transport` 对畸形行/不匹配 id 会设 `lastProtocolError` 并返回（:113-135），对应请求随后超时——诚实（不伪造成功）。但 `getLastProtocolError()`（:68）在 adapter/gate 里从未被读取，协议层的具体错因不会进入审计，只呈现为通用 timeout。降级是显式的（超时），但错因可见性有损。列 P2。

### 3.2 `serialport` 缺失显式抛错 — 无缺陷（正向确认）
`loadSerialPortModule`（各处）在包未装时抛明确错误，绝不静默退回 mock。符合不变量 3。

---

## 不变量 4：诚实审计（provenance / hardwareSignalSent 真实）

### 4.1 写超时后 `signalSent:true` 可能高报"已发信号" — **P2**
`Esp32DeviceAdapter.execute` 的 catch 分支（:85-96）：连接后 write 抛错或超时时返回 `signalSent: true`，注释说"信号可能已离开主机"。审计据此记 `hardwareSignalSent=true`，而实际可能一字节未成功发出。方向是**保守偏安全**（宁可多报发送、绝不少报），可接受，但严格意义上审计可能声称发了实际没发的信号。列 P2，建议增加"attempted/confirmed"二态而非单布尔。

### 4.2 固件 `move_to_angle` 回报的是**指令角**非**实测角** — **P2**
固件成功时回 `data.angle = 命令角`（`.ino` handleMoveToAngle），SG90 开环无位置反馈。审计里的 "executed" 含义是"命令被接受且 `servo.write` 已调用"，不等于"舵机物理到位"。开环舵机的固有限制，但审计语义应显式声明为"commanded, not verified"，否则读者会误以为是实测。列 P2。

---

## 不变量 5：提案者不可信（越界拒绝而非钳制）

### 5.1 三层均拒不钳制 — 正向确认
SafetyMonitor（:99）、adapter（:62）、固件（angle<0||>180 refused）三处越界一律拒绝、绝不钳制；NaN 显式挡；Infinity 被 `>180` 拦。符合不变量 5。

### 5.2 SafetyMonitor 仅对 `move_to_angle` 做数值范围检查 — **P2（扩展性）**
`SafetyMonitor.ts:92` 的范围检查是 `move_to_angle` 专属分支。若将来新增带数值边界的 actuation 能力，SafetyMonitor 无通用边界机制，新能力会无范围检查通过（届时仅剩 adapter/固件兜底）。当前只有 move_to_angle actuate，无实际风险。列 P2，标记为"新增执行能力前必须补通用边界检查"。

---

## 不变量 6：仿真与真实可见区分

### 6.1 无缺陷（正向确认）
`HardwareGateOutcome.executionMode` 硬编码 `'real_hardware'`（`HardwareExecutionGate.ts:17`）并进审计；仿真路径带 `[SIMULATION]`。真实/仿真在审计与日志层不可混淆。符合不变量 6。（注：electron 侧重复协议客户端属前端路径，不在本次范围。）

---

## 跨切面（低优先）

- **P2 主机接收缓冲无上限**：`SerialEsp32Transport.handleData` 的 `this.buffer` 无长度上限；设备若持续发无换行数据，主机内存增长（固件侧 lineBuffer 有 512 上限，方向不对称）。设备半可信，列 P2。
- **P2 请求 id 复用碰撞**：pending 以 id 为键，若主机复用 id，第二个会覆盖第一个的 resolver。主机当前用时间戳+随机后缀生成 id，碰撞概率极低。列 P2。

---

## 汇总表

| 编号 | 不变量 | 严重度 | 一句话 |
|---|---|---|---|
| 1.1 | 1 单一通路 | P1 | adapter.execute/transport.send 公有，绕过 gate 仅靠约定 |
| 2.1 | 2 默认拦截 | P1（可升P0）| 传感器策略由调用方装配，缺策略⇒放行执行 |
| 2.2 | 2 默认拦截 | P1 | 新鲜度用主机时间戳，pull 模型下 sensor_stale 恒不触发 |
| 2.3 | 2 默认拦截 | P2 | capabilityLimits 是调用方数据，min/max 可缺（双层兜底） |
| 3.1 | 3 无静默回退 | P2 | lastProtocolError 记录但无人读，错因不进审计 |
| 4.1 | 4 诚实审计 | P2 | 写超时后 signalSent:true 可能高报已发送 |
| 4.2 | 4 诚实审计 | P2 | 固件回报指令角非实测角，"executed"语义需澄清 |
| 5.2 | 5 提案不可信 | P2 | 数值范围检查仅 move_to_angle 专属，新增执行能力有缺口 |
| x.1 | 跨切面 | P2 | 主机接收缓冲无上限 |
| x.2 | 跨切面 | P2 | 请求 id 复用理论碰撞 |

**建议优先级**：先议 2.1（默认拦截被外移，风险最高）→ 2.2（新鲜度失效）→ 1.1（通路封装）。这三项决定了六层防护的"结构性"成色。P2 可打包在真机验收后统一处理。

**再次声明**：以上仅为分析，未改任何代码。请逐条批复，我按批准项分别提修复方案（仍受冻结令约束——修复属"修 bug"范畴，但改动安全层需你显式批准每一条）。
