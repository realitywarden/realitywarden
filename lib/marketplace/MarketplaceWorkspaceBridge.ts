import type { DeviceAsset } from '../assets/DeviceAsset';
import { DeviceCapabilitySchema, DeviceGeometrySchema, DeviceMetaSchema, DeviceTypeSchema } from '../schemas/deviceMeta.schema';
import { validateRealityAssetPackage } from '../reality-assets/assetValidator';
import type { RealityAssetPackage } from '../reality-assets/types';
import type { DeviceCapability, DeviceMeta } from '../../types/deviceMeta';
import type { MarketplaceTrustTier } from './MarketplacePackage';

export interface VerifiedMarketplaceRuntimeAsset {
  packageId: string;
  packageVersion: string;
  digestSha256: string;
  trustTier: MarketplaceTrustTier;
  publisherName: string;
  asset: RealityAssetPackage;
  executionAuthorityGranted: false;
  realAdapterEnabled: false;
}

export type MarketplaceWorkspaceBindingResult =
  | { ok: true; asset: DeviceAsset }
  | { ok: false; code: string; detail: string };

function reject(code: string, detail: string): MarketplaceWorkspaceBindingResult {
  return { ok: false, code, detail };
}

function duplicate(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function riskClass(asset: RealityAssetPackage): DeviceMeta['risk_class'] {
  const risks = [asset.deviceManifest.riskProfile.baseRisk, ...asset.capabilityContracts.map((capability) => capability.riskLevel)];
  if (risks.some((risk) => risk === 'high' || risk === 'critical')) return 'high';
  return risks.includes('medium') ? 'medium' : 'low';
}

/**
 * Binds a main-process-verified Marketplace Reality Asset to an existing,
 * trusted semantic geometry template. This conversion never aliases, drops,
 * intersects, or adds capabilities: every executable id must already be a
 * supported DeviceCapability on the template, otherwise the whole binding is
 * refused. It creates simulation/read-only data only and grants no hardware
 * execution authority.
 */
function bindVerifiedMarketplaceAsset(input: {
  runtimeAsset: VerifiedMarketplaceRuntimeAsset;
  templateAsset: DeviceAsset;
}): MarketplaceWorkspaceBindingResult {
  const { runtimeAsset, templateAsset } = input;
  if (runtimeAsset.executionAuthorityGranted !== false || runtimeAsset.realAdapterEnabled !== false) {
    return reject('authority_rejected', 'Marketplace runtime input must carry literal zero execution authority');
  }
  if (!/^[a-f0-9]{64}$/.test(runtimeAsset.digestSha256)) return reject('digest_rejected', 'Marketplace digest must be lowercase sha256');
  const checked = validateRealityAssetPackage(runtimeAsset.asset);
  if (!checked.valid || !checked.normalizedAsset) return reject('asset_rejected', checked.errors.join('; '));
  const asset = checked.normalizedAsset;
  if (asset.supportLevel !== 'simulation_only' && asset.supportLevel !== 'read_only') {
    return reject('support_level_rejected', 'Only simulation_only or read_only Marketplace assets can bind to Virtual Lab');
  }
  if (
    asset.adapterBoundary.realAdapterEnabled !== false
    || asset.deviceManifest.adapter.realAdapterEnabled !== false
    || asset.adapterBoundary.taskDslIsHardwareCommand !== false
  ) return reject('real_authority_rejected', 'Marketplace workspace binding must remain structurally simulation/read-only');

  const deviceType = DeviceTypeSchema.safeParse(asset.deviceType);
  if (!deviceType.success) return reject('device_type_unsupported', `Virtual Lab has no governed semantic profile for ${asset.deviceType}`);
  if (templateAsset.manifest.device_type !== deviceType.data) return reject('template_type_mismatch', 'trusted geometry template device type does not match the signed asset');
  if (
    templateAsset.adapterManifest.adapter_type !== 'simulator'
    || templateAsset.adapterManifest.real_device_enabled !== false
    || templateAsset.deviceMeta.supported_adapters.some((adapter) => adapter !== 'simulator')
  ) return reject('template_authority_rejected', 'trusted geometry template is not structurally simulation-only');
  const geometry = DeviceGeometrySchema.safeParse(templateAsset.geometry);
  if (!geometry.success) return reject('template_geometry_rejected', geometry.error.issues.map((issue) => issue.message).join('; '));

  const manifestIds = asset.deviceManifest.capabilities.map((capability) => capability.id);
  const contractIds = asset.capabilityContracts.map((capability) => capability.id);
  const repeated = duplicate(manifestIds) ?? duplicate(contractIds);
  if (repeated) return reject('duplicate_capability', `duplicate capability is refused: ${repeated}`);
  if (manifestIds.length !== contractIds.length || manifestIds.some((id, index) => id !== contractIds[index])) {
    return reject('capability_contract_mismatch', 'manifest and capabilityContracts must contain the same ordered capability ids; no narrowing is performed');
  }
  const capabilities: DeviceCapability[] = [];
  for (const capability of asset.capabilityContracts) {
    const parsed = DeviceCapabilitySchema.safeParse(capability.id);
    if (!parsed.success) return reject('capability_unsupported', `Virtual Lab cannot execute capability without an exact semantic id: ${capability.id}`);
    if (!templateAsset.adapterManifest.supported_commands.includes(parsed.data)) {
      return reject('template_capability_mismatch', `trusted template does not support signed capability: ${parsed.data}`);
    }
    if (capability.executionPermission !== 'simulation_only' && capability.executionPermission !== 'read_only') {
      return reject('capability_permission_rejected', `capability ${capability.id} is not simulation_only/read_only`);
    }
    if (asset.supportLevel === 'read_only' && capability.executionPermission !== 'read_only') {
      return reject('read_only_violation', `read_only asset contains non-read-only capability: ${capability.id}`);
    }
    capabilities.push(parsed.data);
  }

  const geometryZones = new Set(Object.keys(geometry.data.zones));
  const declaredZones = [...asset.deviceManifest.workspace.allowedZones, ...asset.deviceManifest.workspace.forbiddenZones];
  const repeatedZone = duplicate(declaredZones);
  if (repeatedZone) return reject('duplicate_zone', `zone cannot be both repeated or ambiguous: ${repeatedZone}`);
  const unknownZone = declaredZones.find((zone) => !geometryZones.has(zone));
  if (unknownZone) return reject('template_zone_mismatch', `signed zone is absent from trusted geometry: ${unknownZone}`);
  const worldZoneIds = asset.worldModelAssumptions.zones.map((zone) => zone.id);
  if (duplicate(worldZoneIds)) return reject('duplicate_world_zone', 'world model contains duplicate zone ids');
  for (const zone of declaredZones) {
    if (!worldZoneIds.includes(zone)) return reject('world_zone_mismatch', `signed workspace zone is absent from world model: ${zone}`);
  }

  const id = `marketplace-${runtimeAsset.packageId}-${runtimeAsset.digestSha256.slice(0, 12)}`;
  const meta = DeviceMetaSchema.safeParse({
    profile_id: id,
    profile_version: runtimeAsset.packageVersion,
    manufacturer: asset.vendor,
    model: asset.name,
    device_id: `simulation-${id}`,
    device_type: deviceType.data,
    simulator_profile: `${deviceType.data}_semantic_v1`,
    simulator_fidelity: {
      level: 'semantic',
      validates: ['signed Marketplace capability ids', 'declared zones', 'TaskDSL safety and simulator adapter boundary'],
      limitations: ['Geometry comes from a separately trusted semantic template and is not vendor CAD or physical proof.']
    },
    supported_adapters: ['simulator'],
    risk_class: riskClass(asset),
    display_name: asset.name,
    model_asset: templateAsset.deviceMeta.model_asset,
    capabilities,
    constraints: {
      workspace: geometry.data.workspace,
      max_speed: asset.deviceManifest.constraints.maxSpeed,
      force_limit: asset.deviceManifest.constraints.maxForce,
      forbidden_zones: [...asset.deviceManifest.workspace.forbiddenZones],
      known_targets: [...asset.deviceManifest.workspace.allowedZones]
    },
    safety_profile: {
      allow_throwing: false,
      allow_high_force: false,
      allow_outside_workspace: false,
      medium_risk_requires_confirmation: false,
      block_medium_risk: true,
      require_logging: true,
      require_human_confirmation_for_risky_actions: true
    },
    runtime_state: { status: 'idle', current_position: 'marketplace_simulation_origin' }
  });
  if (!meta.success) return reject('generated_profile_rejected', meta.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));

  const generated: DeviceAsset = {
    manifest: {
      asset_id: id,
      display_name: asset.name,
      category: 'marketplace_signed',
      device_type: deviceType.data,
      license: 'publisher-provided; verify package submission terms',
      brand: asset.vendor,
      source: `marketplace:${runtimeAsset.packageId}:${runtimeAsset.digestSha256}`,
      visual_model: { ...templateAsset.manifest.visual_model },
      allowed_use: ['simulation', 'development', 'testing'],
      simulator_fidelity: 'semantic',
      risk_class: meta.data.risk_class
    },
    deviceMeta: meta.data as DeviceMeta,
    geometry: geometry.data,
    adapterManifest: {
      adapter_id: `simulator-${id}`,
      adapter_type: 'simulator',
      interface: 'AdapterInterface',
      supported_commands: [...capabilities],
      transport: 'virtual-device-runtime',
      real_device_enabled: false
    },
    scenarios: {
      safe: {
        ...templateAsset.scenarios.safe,
        id: `${id}-safe`,
        device_profile: id,
        prompt: asset.examplePrompts.supported[0] ?? 'Inspect this signed simulation asset.',
        expected_task_type: 'marketplace_signed_simulation'
      },
      unsafe: {
        ...templateAsset.scenarios.unsafe,
        id: `${id}-unsafe`,
        device_profile: id,
        prompt: asset.examplePrompts.unsafe[0] ?? 'Attempt a forbidden Marketplace action.',
        expected_task_type: 'marketplace_signed_blocked'
      }
    }
  };
  return { ok: true, asset: generated };
}

export function bindMarketplaceAssetToVirtualLab(input: {
  runtimeAsset: VerifiedMarketplaceRuntimeAsset;
  templateAsset: DeviceAsset;
}): MarketplaceWorkspaceBindingResult {
  try {
    return bindVerifiedMarketplaceAsset(input);
  } catch (error) {
    return reject(
      'malformed_runtime_asset',
      `Marketplace workspace input was malformed and was refused: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
