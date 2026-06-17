import type { DeviceMeta, DeviceGeometry, DeviceType } from '@/types/deviceMeta';

export interface DeviceAssetManifest {
  asset_id: string;
  display_name: string;
  category: string;
  device_type: DeviceType;
  license: string;
  brand: 'generic' | string;
  source: string;
  visual_model: {
    type: 'procedural_fallback' | 'glb' | 'gltf';
    path: string | null;
  };
  allowed_use: Array<'simulation' | 'development' | 'testing' | string>;
  simulator_fidelity?: 'semantic' | 'kinematic' | 'physics';
  risk_class?: 'low' | 'medium' | 'high';
}

export interface AdapterManifest {
  adapter_id: string;
  adapter_type: 'simulator' | 'real_device' | string;
  interface: 'AdapterInterface' | string;
  supported_commands: string[];
  transport: string;
  real_device_enabled: boolean;
}

export interface DeviceAssetScenario {
  id: string;
  device_profile: string;
  initial_state: Record<string, unknown>;
  prompt: string;
  expected_task_type: string;
  unsafe_actions: string[];
  expected_safety_result: 'pass' | 'blocked';
  expected_state_after: Record<string, unknown>;
}

export interface DeviceAsset {
  manifest: DeviceAssetManifest;
  deviceMeta: DeviceMeta;
  geometry: DeviceGeometry;
  adapterManifest: AdapterManifest;
  scenarios: {
    safe: DeviceAssetScenario;
    unsafe: DeviceAssetScenario;
  };
}
