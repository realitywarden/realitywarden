export type {
  CapabilityContract,
  DeviceManifest,
  WorldModel,
  Goal,
  RuntimePlan as Plan,
  SafetyEnvelope,
  ExecutionPermission,
  SupportLevel,
  OpenRealityTaskDSL as TaskDSL
} from '../open-reality-runtime/types';

export interface AdapterBoundary {
  interfaceName: 'AdapterInterface';
  runtimeBoundary: 'simulation_first';
  adapterRequired: true;
  realDeviceExecution: false;
  realAdapterEnabled: false;
  dryRunOnly: true;
}
