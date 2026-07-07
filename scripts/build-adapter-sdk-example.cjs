const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const protocolDir = path.join(root, 'examples', 'protocol');
const adapterSdkDir = path.join(root, 'examples', 'adapter-sdk');
const intakePath = path.join(protocolDir, 'openreality-protocol-v0.1.adapter-intake.json');
const summaryPath = path.join(adapterSdkDir, 'openreality-adapter-sdk-v0.1.intake-summary.json');
const stubPath = path.join(adapterSdkDir, 'simulation-adapter.stub.ts');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const intake = readJson(intakePath);
const acceptedDeviceTypes = intake.simulation_runtime_accepts.map((entry) => entry.device_type);
const acceptedAssetIds = intake.simulation_runtime_accepts.map((entry) => entry.asset_id);

const summary = {
  protocol_version: intake.protocol_version,
  source: path.relative(root, intakePath),
  accepted_asset_ids: acceptedAssetIds,
  accepted_device_types: acceptedDeviceTypes,
  protocol_only_device_types: intake.protocol_only_assets.map((entry) => entry.device_type),
  adapter_sdk_rules: {
    simulation_only: true,
    deny_real_device_execution: true,
    require_runtime_permission_gate: true,
    require_public_alpha_runnable_gate: true
  }
};

const stubSource = `import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { AdapterInterface } from '@/lib/adapter/AdapterInterface';
import type { AdapterResult } from '@/lib/adapter/AdapterResult';
import type { DeviceMeta } from '@/types/deviceMeta';

const PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES = new Set(${JSON.stringify(acceptedDeviceTypes)});

export class SimulationOnlyAdapterStub implements AdapterInterface {
  constructor(
    private readonly deviceMeta: DeviceMeta,
    private readonly initialState: Record<string, unknown> = { status: 'idle' }
  ) {}

  private connected = false;
  private state = { ...this.initialState };

  async connect(): Promise<void> {
    if (!PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES.has(this.deviceMeta.device_type)) {
      throw new Error(\`\${this.deviceMeta.device_type} is protocol-only in Public Alpha.\`);
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getDeviceMeta(): Promise<DeviceMeta> {
    return this.deviceMeta;
  }

  async executeCommand(command: AdapterCommand): Promise<AdapterResult> {
    if (!this.connected) {
      return { command_id: command.id, status: 'failed', message: 'Adapter is not connected.' };
    }
    if (!command.allowed) {
      return { command_id: command.id, status: 'blocked', message: command.blocked_reason ?? 'Command blocked before adapter execution.' };
    }
    this.state = {
      ...this.state,
      status: 'executed',
      last_command: command.action,
      last_target: command.target,
      runtime_mode: 'simulation-only'
    };
    return {
      command_id: command.id,
      status: 'ok',
      state_patch: this.state,
      message: 'SimulationOnlyAdapterStub accepted a Public Alpha simulation command.'
    };
  }

  async getState(): Promise<Record<string, unknown>> {
    return { ...this.state };
  }

  async stop(): Promise<AdapterResult> {
    this.state = { ...this.state, status: 'stopped' };
    return { command_id: 'stop', status: 'ok', state_patch: this.state, message: 'Simulation adapter stopped.' };
  }

  async emergencyStop(): Promise<AdapterResult> {
    this.state = { ...this.state, status: 'emergency_stopped' };
    return { command_id: 'emergency-stop', status: 'ok', state_patch: this.state, message: 'Simulation adapter emergency stopped.' };
  }
}
`;

fs.mkdirSync(adapterSdkDir, { recursive: true });
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(stubPath, stubSource);

console.log(`Built adapter SDK summary at ${path.relative(root, summaryPath)}`);
console.log(`Built adapter SDK stub at ${path.relative(root, stubPath)}`);
