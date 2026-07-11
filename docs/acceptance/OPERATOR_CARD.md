# 真机验收操作卡（P0 四场景 · 单页版）

> 逐行照做即可。任何一步卡住 → 先跑只读诊断，再查 `docs/REAL_HARDWARE_ESP32.md` 的 Troubleshooting，不要跳步。
> host 侧链路已由 `npm run test:virtual-loopback`（虚拟串口全链路 e2e，5 场景）预先证明——真机上如果失败，问题必在固件/接线/供电，不在软件。

## 0. 前置检查（一次性，约 10 分钟）

| # | 动作 | 通过标准 |
|---|------|----------|
| 1 | Arduino IDE 烧录 `firmware/esp32-realitywarden/esp32-realitywarden.ino` | 上传成功。**必须重刷**：旧固件不发 deviceMs，场景 1 会被 `device_timestamp_unavailable` 拦（这是预期防护，不是硬件坏了） |
| 2 | ESP32-S3 注意双串口 | 烧录用 UART0/"COM" 口；运行用固件实际打印的口（`USB CDC On Boot: Enabled` 时是原生 USB 口）。设备管理器确认 COM 号 |
| 3 | 供电 | 用电脑 USB 或插墙充电头。**不要用普通充电宝**（低负载自动断电） |
| 4 | 接线 | SG90→GPIO18；HC-SR04 VCC→5V、TRIG→GPIO5、ECHO→**1kΩ+2kΩ 分压**→GPIO4；外部供电必须与 ESP32 **共地** |
| 5 | `npm install`（含 serialport） | 无报错 |
| 6 | `npm run hardware:diagnose -- --port COMx` | 结尾 PASS：有效读数 + deviceMs 正常。FAIL 则按输出的分类结论排查（可加 `--loopback` 做 GPIO5→GPIO4 接线自检） |

## 1. 四场景执行（按顺序）

```bash
# 场景 1+2：合法角度执行 + 越界拦截（无需人工介入）
npm run hardware:demo -- --port COMx

# 场景 3：手或硬板挡在探头前 <10cm，保持住再运行
npm run hardware:demo -- --port COMx --scenario 3

# 场景 4：先拔掉 HC-SR04 的 ECHO 或 VCC，再运行
npm run hardware:demo -- --port COMx --scenario 4
```

## 2. 判定标准（全部满足才算过）

| 场景 | 眼睛看到 | 审计日志里 |
|------|----------|-----------|
| 1 `move_to_angle 45` | **舵机转动** | `executed`，`hardwareSignalSent: true` |
| 2 `move_to_angle 200` | 舵机纹丝不动 | `blocked`（`angle_out_of_range`），`hardwareSignalSent: false` |
| 3 障碍 <10cm | 舵机纹丝不动 | `blocked`（`min_safe_distance_violation`） |
| 4 传感器拔线 | 舵机纹丝不动 | `blocked`（`sensor_missing`） |

任一场景"blocked 但舵机动了" = **P0 安全事故**，立即停，保留日志找我。

## 3. 证据存档（DoD）

每次运行结尾打印完整审计 JSON。四份分别存为：

```
docs/acceptance/evidence/2026-MM-DD-scenario-1.json  （…-2 / -3 / -4 同理）
```

四份齐 → 验收通过 → **功能冻结令解除**（见 STATUS.md 解锁顺序）。

## 4. 常见卡点速查

- 全部超时 → 串口选错（S3 双口）/ 波特率非 115200 / 固件没跑起来
- `no echo pulse` → 供电不足（5V 档位跳线!）、缺共地、探头前 10–30cm 放硬板复测
- 读数恒为 ~0.017cm 的小整数倍 → 发射头没工作，查 5V 供电
- 场景 1 被 `device_timestamp_unavailable` 拦 → 没重刷固件，回第 0 步第 1 行
- 端口被占 → 关串口监视器 / Arduino IDE

详细版：`docs/REAL_HARDWARE_ESP32.md`（Troubleshooting 含真实报错样例）
