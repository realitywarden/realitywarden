import type {
  CapabilityContract,
  DeviceManifest,
  RuntimeDeviceType,
  SupportLevel,
  WorldModel
} from '../open-reality-runtime/types';

export type RealityAssetSupportLevel = SupportLevel;
export type RealityAssetAdapterMode = 'simulation' | 'read_only' | 'real_disabled';

export interface RealityAssetAdapterBoundary {
  simulationAdapterAvailable: boolean;
  realAdapterEnabled: false;
  modes: RealityAssetAdapterMode[];
  taskDslIsHardwareCommand: false;
  adapterNote: string;
}

export interface RealityAssetExamplePrompts {
  supported: string[];
  unsupported: string[];
  unsafe: string[];
  ambiguous: string[];
}

export interface RealityAssetValidationRules {
  requiresDeviceManifest: boolean;
  requiresCapabilityContracts: boolean;
  requiresSupportLevel: boolean;
  realAdapterMustBeDisabled: boolean;
  comingSoonMustNotBeRunnable: boolean;
  unsupportedMustNotFallback: boolean;
  requiresExamplePrompt: boolean;
}

export interface RealityAssetPackage {
  assetId: string;
  name: string;
  version: string;
  vendor: string;
  deviceType: RuntimeDeviceType;
  deviceManifest: DeviceManifest;
  capabilityContracts: CapabilityContract[];
  worldModelAssumptions: Pick<WorldModel, 'objects' | 'zones' | 'confidence'>;
  adapterBoundary: RealityAssetAdapterBoundary;
  examplePrompts: RealityAssetExamplePrompts;
  validationRules: RealityAssetValidationRules;
  supportLevel: RealityAssetSupportLevel;
  safetyNotes: string[];
}

export interface RealityAssetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedAsset?: RealityAssetPackage;
}
