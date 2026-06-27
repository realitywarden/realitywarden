import type { DeviceManifest, SupportLevel } from './contracts';

export interface ProtocolSpec {
  protocolName: 'Open Reality Protocol';
  version: '0.1';
  runtimeBoundary: 'simulation_first';
  realDeviceExecution: false;
  executionModes: readonly ['simulation_only', 'read_only', 'ask_human', 'blocked'];
}

export const OPEN_REALITY_PROTOCOL_SPEC: ProtocolSpec = {
  protocolName: 'Open Reality Protocol',
  version: '0.1',
  runtimeBoundary: 'simulation_first',
  realDeviceExecution: false,
  executionModes: ['simulation_only', 'read_only', 'ask_human', 'blocked']
};

export const PROTOCOL_RUNNABLE_SUPPORT_LEVELS: readonly SupportLevel[] = ['simulation_only', 'read_only'];

export function isProtocolRunnableSupportLevel(level: SupportLevel) {
  return PROTOCOL_RUNNABLE_SUPPORT_LEVELS.includes(level);
}

export function toProtocolExecutionPermission(manifest: DeviceManifest) {
  if (manifest.supportLevel === 'simulation_only') return 'simulation_only';
  if (manifest.supportLevel === 'read_only') return 'read_only';
  return 'blocked';
}

export function isProtocolRunnableManifest(manifest: DeviceManifest) {
  return isProtocolRunnableSupportLevel(manifest.supportLevel);
}
