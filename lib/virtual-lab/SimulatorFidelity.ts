import type { DeviceMeta } from '@/types/deviceMeta';

export function getSimulatorFidelity(deviceMeta: DeviceMeta) {
  return deviceMeta.simulator_fidelity ?? {
    level: 'semantic',
    validates: ['task_dsl', 'safety_runtime', 'adapter_commands', 'state_transition'],
    limitations: ['Does not model high-fidelity physics.']
  };
}
