# Public Launch Copy

Use these drafts for public posts. Keep the boundary clear: this is a simulation-only Public Alpha, not real device execution.

## X / Twitter Short Post

AI should not touch the physical world directly.

RealityWarden is a simulation-first desktop runtime for Physical AI workflows:

- natural language goals
- device capability checks
- safety-gated simulation
- Reality Asset packages
- no real device execution yet

Public Alpha:
https://github.com/ZqiEE/open-reality-studio

## X / Twitter Technical Variant

Released RealityWarden Public Alpha.

It is a local desktop prototype for testing Physical AI workflows before real hardware:

- Runtime Kernel
- Capability Contracts
- Safety Governor
- TaskDSL
- simulation playback
- Reality Asset Developer Kit

Simulation-only for now:
https://github.com/ZqiEE/open-reality-studio

## Reddit / Hacker News Long Post

I am building RealityWarden, a simulation-first desktop runtime for Physical AI workflows.

The idea is simple: AI should not send commands directly to physical devices. Before anything reaches reality, the system should understand the goal, check the target device's capabilities, simulate the action, block unsafe commands, and leave an audit trail.

The current Public Alpha includes:

- runnable simulation path for `robot_arm`
- limited low-risk simulation path for `smart_light`
- limited read-only/capture simulation path for `camera_sensor`
- Runtime Kernel for capability and safety decisions
- Reality Asset packages for describing devices
- local validation for third-party Reality Assets

Current boundaries:

- simulation-only
- no real device execution
- no production hardware control
- no certified industrial safety guarantee
- other devices remain Coming Soon

GitHub:
https://github.com/ZqiEE/open-reality-studio

I am looking for feedback on the runtime boundary, device asset format, and the first developer onboarding path.

## GitHub Discussions Intro

RealityWarden is a simulation-first desktop runtime for Physical AI workflows.

The project explores the runtime layer between AI agents and physical devices:

- Natural Language
- Runtime Kernel
- World Model
- Capability Contract
- Safety Governor
- TaskDSL
- Simulation Runtime
- Adapter Boundary
- Lab Report / Audit / Replay

The current Public Alpha is intentionally narrow and honest: `robot_arm`, `smart_light`, and `camera_sensor` have runnable simulation paths. Other device families are Coming Soon. Real device execution is not enabled.

Feedback wanted:

- Is the Reality Asset Package format clear?
- Which low-risk devices should be modeled next?
- What would make this easier for developers to try?

## Chinese Short Intro

RealityWarden 是一个 simulation-first 的 Physical AI 桌面运行时原型。

核心想法是：AI 不应该直接控制现实设备。真正接触硬件之前，系统应该先理解目标、检查设备能力、仿真执行、拦截危险指令，并留下审计记录。

当前 Public Alpha 支持：

- `robot_arm` 仿真运行路径
- `smart_light` 低风险仿真路径
- `camera_sensor` 只读/捕获仿真路径
- Reality Asset 设备资产包
- 本地验证工具

边界也很明确：当前不支持真实设备执行，不是生产级硬件控制系统。

GitHub:
https://github.com/ZqiEE/open-reality-studio
