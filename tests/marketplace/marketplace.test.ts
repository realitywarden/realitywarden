import { strict as assert } from 'node:assert';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  enableMarketplaceSimulation,
  createEmptyMarketplaceState,
  installMarketplacePackage,
  bindMarketplaceAssetToVirtualLab,
  marketplaceRuntimeAsset,
  signMarketplaceCatalog,
  verifyMarketplaceCatalog,
  verifyMarketplaceCatalogPackage,
  validateMarketplaceDistributionConfig,
  marketplaceWorkspaceReference,
  removeUnavailableMarketplaceWorkspaceDevices,
  marketplaceRuntimeManifest,
  marketplaceSigningPayload,
  restoreMarketplaceState,
  revokeCommunityPublisher,
  signMarketplacePackage,
  serializeMarketplaceState,
  trustCommunityPublisher,
  uninstallMarketplacePackage,
  verifyMarketplacePackage,
  type MarketplaceInstallRecord,
  type MarketplacePackage,
  type MarketplaceTrustEntry,
  type VerifiedMarketplaceRuntimeAsset
} from '../../lib/marketplace';
import type { DeviceAsset } from '../../lib/assets/DeviceAsset';
import type { RealityAssetPackage } from '../../lib/reality-assets';

const asset = JSON.parse(readFileSync('examples/reality-assets/desktop_fan.asset.json', 'utf8').replace(/^\uFEFF/, '')) as RealityAssetPackage;
const officialKeys = generateKeyPairSync('ed25519');
const communityKeys = generateKeyPairSync('ed25519');
const unknownKeys = generateKeyPairSync('ed25519');

function cameraMarketplaceAsset(): RealityAssetPackage {
  const capabilityIds = ['capture_frame', 'read_sensor', 'scan_area'];
  const contracts = capabilityIds.map((id) => ({
    ...asset.capabilityContracts[0],
    id,
    name: id,
    category: id === 'read_sensor' || id === 'capture_frame' ? 'observation' : 'actuation',
    executionPermission: id === 'read_sensor' ? 'read_only' : 'simulation_only',
    riskLevel: 'low'
  }));
  return {
    ...asset,
    assetId: 'signed_marketplace_camera',
    name: 'Signed Marketplace Camera',
    deviceType: 'camera_sensor',
    deviceManifest: {
      ...asset.deviceManifest,
      deviceId: 'signed_marketplace_camera',
      displayName: 'Signed Marketplace Camera',
      capabilities: contracts.map((contract) => ({ ...contract })),
      workspace: { allowedZones: ['camera_view'], forbiddenZones: ['privacy_zone'] },
      constraints: { ...asset.deviceManifest.constraints },
      riskProfile: { ...asset.deviceManifest.riskProfile, hazardousCapabilities: [...asset.deviceManifest.riskProfile.hazardousCapabilities], blockedGoals: [...asset.deviceManifest.riskProfile.blockedGoals] },
      adapter: { ...asset.deviceManifest.adapter, realAdapterEnabled: false }
    },
    capabilityContracts: contracts,
    worldModelAssumptions: {
      ...asset.worldModelAssumptions,
      objects: [{ id: 'signed_camera', type: 'camera_sensor', zone: 'camera_view', movable: false }],
      zones: [
        { id: 'camera_view', label: 'Camera view', safe: true },
        { id: 'privacy_zone', label: 'Privacy zone', safe: false }
      ]
    }
  } as RealityAssetPackage;
}

function cameraTemplate(): DeviceAsset {
  return {
    manifest: {
      asset_id: 'trusted-camera-template', display_name: 'Trusted camera template', category: 'vision',
      device_type: 'camera_sensor', license: 'project-owned-generic', brand: 'generic', source: 'test-fixture',
      visual_model: { type: 'procedural_fallback', path: null }, allowed_use: ['simulation'], simulator_fidelity: 'semantic', risk_class: 'low'
    },
    deviceMeta: {
      profile_id: 'trusted-camera-template', profile_version: '1.0.0', manufacturer: 'RealityWarden', model: 'Trusted camera template',
      device_id: 'trusted-camera-template', device_type: 'camera_sensor', simulator_profile: 'camera_sensor_semantic_v1',
      supported_adapters: ['simulator'], risk_class: 'low', display_name: 'Trusted camera template',
      capabilities: ['capture_frame', 'read_sensor', 'scan_area'],
      constraints: {
        workspace: { x_min: -2, x_max: 2, y_min: 0, y_max: 2, z_min: -2, z_max: 2 },
        max_speed: 'normal', force_limit: 'low', forbidden_zones: ['privacy_zone'], known_targets: ['camera_view', 'privacy_zone']
      },
      safety_profile: {
        allow_throwing: false, allow_high_force: false, allow_outside_workspace: false,
        require_logging: true, require_human_confirmation_for_risky_actions: false
      },
      runtime_state: { status: 'idle', current_position: 'camera_view' }
    },
    geometry: {
      table: { width: 2.2, depth: 1.6, height: 0.05 },
      robot: { base_position: [0, 0, 0], arm_segments: [0.3, 0.3], gripper_size: 0.1 },
      objects: {
        red_cube: { position: [-0.55, 0.1, 0], size: 0.15 }, blue_cube: { position: [0.55, 0.1, 0], size: 0.15 },
        glass_cup: { position: [0, 0.1, 0.45], radius: 0.05, height: 0.15 }
      },
      zones: {
        camera_view: { position: [0, 0.04, 0], size: [1.2, 0.8] },
        privacy_zone: { position: [0.75, 0.04, 0.45], size: [0.55, 0.45] }
      },
      workspace: { x_min: -2, x_max: 2, y_min: 0, y_max: 2, z_min: -2, z_max: 2 },
      camera: { position: [1.7, 1.8, 1.6], target: [0, 0, 0] }, stage: { layout: 'camera_sensor' }
    },
    adapterManifest: {
      adapter_id: 'simulator-trusted-camera-template', adapter_type: 'simulator', interface: 'AdapterInterface',
      supported_commands: ['capture_frame', 'read_sensor', 'scan_area'], transport: 'virtual-device-runtime', real_device_enabled: false
    },
    scenarios: {
      safe: { id: 'camera-safe', device_profile: 'trusted-camera-template', initial_state: {}, prompt: 'Capture.', expected_task_type: 'safe_validation', unsafe_actions: [], expected_safety_result: 'pass', expected_state_after: {} },
      unsafe: { id: 'camera-unsafe', device_profile: 'trusted-camera-template', initial_state: {}, prompt: 'Capture privacy zone.', expected_task_type: 'unsafe_validation', unsafe_actions: ['privacy_zone'], expected_safety_result: 'blocked', expected_state_after: {} }
    }
  };
}

const trustStore: MarketplaceTrustEntry[] = [
  {
    keyId: 'realitywarden.official.v1',
    displayName: 'RealityWarden Review Board',
    publicKeyPem: officialKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    trustTier: 'official',
    revoked: false
  },
  {
    keyId: 'community.fixture.v1',
    displayName: 'Fixture Community Publisher',
    publicKeyPem: communityKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    trustTier: 'community',
    revoked: false
  }
];

const productionDistribution = validateMarketplaceDistributionConfig({
  schema: 'realitywarden.marketplace-distribution',
  schema_version: 1,
  catalog_url: 'https://marketplace.realitywarden.example/catalog.json',
  catalog_key_id: 'realitywarden.official.v1',
  bundled_trust: [trustStore[0]]
}, { productionRequired: true });
assert.equal(productionDistribution.ok, true, 'production distribution should accept a public official Ed25519 key and HTTPS catalog');
assert.match(productionDistribution.fingerprints[0].fingerprintSha256, /^[a-f0-9]{64}$/);
assert.equal(validateMarketplaceDistributionConfig({
  schema: 'realitywarden.marketplace-distribution', schema_version: 1,
  catalog_url: 'http://insecure.example/catalog.json', catalog_key_id: 'realitywarden.official.v1', bundled_trust: [trustStore[0]]
}, { productionRequired: true }).ok, false, 'production distribution must refuse HTTP catalogs');
assert.equal(validateMarketplaceDistributionConfig({
  schema: 'realitywarden.marketplace-distribution', schema_version: 1,
  catalog_url: 'https://marketplace.realitywarden.example/catalog.json', catalog_key_id: 'realitywarden.official.v1', bundled_trust: []
}, { productionRequired: true }).ok, false, 'production distribution must refuse missing official trust instead of pretending the catalog is usable');
assert.equal(validateMarketplaceDistributionConfig({
  schema: 'realitywarden.marketplace-distribution', schema_version: 1,
  catalog_url: 'https://marketplace.realitywarden.example/catalog.json', catalog_key_id: 'realitywarden.official.v1', bundled_trust: [{ ...trustStore[0], publicKeyPem: officialKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }]
}, { productionRequired: true }).ok, false, 'distribution config must never accept private key material');
assert.equal(validateMarketplaceDistributionConfig({
  schema: 'realitywarden.marketplace-distribution', schema_version: 1,
  catalog_url: 'https://marketplace.realitywarden.example/catalog.json', catalog_key_id: 'realitywarden.official.v1', bundled_trust: [trustStore[0], { ...trustStore[0], keyId: 'duplicate.fingerprint' }]
}, { productionRequired: true }).ok, false, 'duplicate public key fingerprints must be refused');
assert.equal(validateMarketplaceDistributionConfig({
  schema: 'realitywarden.marketplace-distribution', schema_version: 1,
  catalog_url: 'https://marketplace.realitywarden.example/catalog.json', catalog_key_id: 'community.fixture.v1', bundled_trust: [{ ...trustStore[1], trustTier: 'community' }]
}, { productionRequired: true }).ok, false, 'bundled config cannot create community trust; community keys remain an explicit local workflow');

function signedPackage(
  packageAsset: RealityAssetPackage = asset,
  options: { key?: typeof officialKeys.privateKey; keyId?: string; displayName?: string; packageId?: string } = {}
): MarketplacePackage {
  const unsigned: Omit<MarketplacePackage, 'signature'> = {
    schema: 'realitywarden.marketplace-package',
    schema_version: 1,
    package_id: options.packageId ?? 'fixture.desktop-fan',
    package_version: '1.0.0',
    published_at: '2026-07-16T10:00:00.000Z',
    publisher: {
      key_id: options.keyId ?? 'realitywarden.official.v1',
      display_name: options.displayName ?? 'RealityWarden Review Board'
    },
    asset: packageAsset
  };
  return {
    ...unsigned,
    signature: {
      algorithm: 'ed25519',
      value: sign(null, marketplaceSigningPayload(unsigned), options.key ?? officialKeys.privateKey).toString('base64')
    }
  };
}

const valid = signedPackage();
const { signature: _fixtureSignature, ...reviewedDraft } = valid;
const signingResult = signMarketplacePackage(
  reviewedDraft,
  officialKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
);
if (!signingResult.ok) throw new Error(signingResult.detail);
assert.equal(signingResult.ok, true, 'maintainer signing should accept a reviewed declarative draft');
assert.equal(verifyMarketplacePackage(signingResult.signed.package, trustStore).ok, true, 'maintainer output must verify under consumer trust policy');

const verified = verifyMarketplacePackage(valid, trustStore);
if (!verified.ok) throw new Error(verified.detail);
assert.equal(verified.ok, true, 'valid signed package should verify');
assert.equal(verified.verified.trustTier, 'official', 'trust tier must come from the local trust store');
assert.equal(verified.verified.package.asset.adapterBoundary.realAdapterEnabled, false);

const noConfirm = installMarketplacePackage({ rawPackage: valid, trustStore, existingRecords: [], confirmed: false });
assert.equal(noConfirm.ok, false, 'installation requires explicit confirmation');

const installed = installMarketplacePackage({
  rawPackage: valid,
  trustStore,
  existingRecords: [],
  confirmed: true,
  now: '2026-07-16T10:01:00.000Z'
});
if (!installed.ok) throw new Error(installed.detail);
assert.equal(installed.ok, true, 'valid package should install');
if (!installed.record) throw new Error('successful installation omitted its record');
assert.equal(installed.record.state, 'installed_disabled', 'marketplace installs must be disabled by default');
assert.equal(installed.record.executionAuthorityGranted, false);
assert.equal(installed.record.realAdapterEnabled, false);
assert.equal(installed.audit.hardwareSignalSent, false, 'install audit must truthfully report no hardware signal');
assert.equal(marketplaceRuntimeManifest(installed.record, trustStore), null, 'disabled package must not enter runtime');

const enableWithoutConfirm = enableMarketplaceSimulation({
  record: installed.record,
  trustStore,
  existingRecords: installed.records,
  confirmed: false
});
assert.equal(enableWithoutConfirm.ok, false, 'simulation enablement requires a second explicit confirmation');

const enabled = enableMarketplaceSimulation({
  record: installed.record,
  trustStore,
  existingRecords: installed.records,
  confirmed: true,
  now: '2026-07-16T10:02:00.000Z'
});
if (!enabled.ok) throw new Error(enabled.detail);
assert.equal(enabled.ok, true, 'validated simulation-only asset should enable in simulation');
if (!enabled.record) throw new Error('successful enablement omitted its record');
assert.equal(enabled.record.state, 'simulation_enabled');
assert.equal(marketplaceRuntimeManifest(enabled.record, trustStore)?.deviceId, asset.deviceManifest.deviceId);
assert.equal(enabled.audit.hardwareSignalSent, false);

const cameraPackage = signedPackage(cameraMarketplaceAsset(), { packageId: 'fixture.signed-camera' });
const cameraPackageBytes = Buffer.from(`${JSON.stringify(cameraPackage, null, 2)}\n`, 'utf8');
const unsignedCatalog = {
  schema: 'realitywarden.marketplace-catalog',
  schema_version: 1,
  catalog_id: 'realitywarden.fixture.catalog',
  generated_at: '2026-07-16T10:00:00.000Z',
  expires_at: '2026-08-16T10:00:00.000Z',
  publisher: { key_id: 'realitywarden.official.v1', display_name: 'RealityWarden Review Board' },
  entries: [{
    package_id: cameraPackage.package_id,
    package_version: cameraPackage.package_version,
    asset_id: cameraPackage.asset.assetId,
    asset_name: cameraPackage.asset.name,
    device_type: cameraPackage.asset.deviceType,
    support_level: cameraPackage.asset.supportLevel,
    package_url: 'https://marketplace.realitywarden.example/packages/fixture.signed-camera-1.0.0.json',
    package_file_sha256: createHash('sha256').update(cameraPackageBytes).digest('hex'),
    package_digest_sha256: verifyMarketplacePackage(cameraPackage, trustStore).ok
      ? (verifyMarketplacePackage(cameraPackage, trustStore) as { ok: true; verified: { digestSha256: string } }).verified.digestSha256
      : ''
  }]
};
const signedCatalog = signMarketplaceCatalog(unsignedCatalog, officialKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
if (!signedCatalog.ok) throw new Error(signedCatalog.detail);
const verifiedCatalog = verifyMarketplaceCatalog(signedCatalog.catalog, trustStore, '2026-07-16T10:30:00.000Z');
assert.equal(verifiedCatalog.ok, true, 'a current signed HTTPS catalog should verify');
assert.equal(verifiedCatalog.verified.trustTier, 'official', 'catalog trust tier must come only from local trust policy');
const catalogPackage = verifyMarketplaceCatalogPackage({ entry: verifiedCatalog.verified.catalog.entries[0], bytes: cameraPackageBytes, trustStore });
assert.equal(catalogPackage.ok, true, 'catalog download must bind file bytes and signed package metadata');
const tamperedCatalog = JSON.parse(JSON.stringify(signedCatalog.catalog));
tamperedCatalog.entries[0].asset_name = 'Tampered listing';
assert.equal(verifyMarketplaceCatalog(tamperedCatalog, trustStore, '2026-07-16T10:30:00.000Z').ok, false,
  'post-signature catalog tampering must be rejected');
const expiredCatalog = verifyMarketplaceCatalog(signedCatalog.catalog, trustStore, '2026-09-16T10:30:00.000Z');
assert.equal(expiredCatalog.ok, false, 'expired catalogs must not appear current');
if (!expiredCatalog.ok) assert.equal(expiredCatalog.code, 'catalog_expired');
const futureCatalog = verifyMarketplaceCatalog(signedCatalog.catalog, trustStore, '2026-07-01T10:30:00.000Z');
assert.equal(futureCatalog.ok, false, 'implausibly future catalogs must be rejected');
if (!futureCatalog.ok) assert.equal(futureCatalog.code, 'catalog_not_yet_valid');
assert.equal(signMarketplaceCatalog({ ...unsignedCatalog, entries: [{ ...unsignedCatalog.entries[0], package_url: 'http://insecure.example/package.json' }] }, officialKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()).ok, false,
  'catalog signing must refuse non-HTTPS package locations');
assert.equal(signMarketplaceCatalog({ ...unsignedCatalog, entries: [unsignedCatalog.entries[0], unsignedCatalog.entries[0]] }, officialKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()).ok, false,
  'catalog signing must refuse duplicate package or asset identities');
const changedBytes = Buffer.from(cameraPackageBytes);
changedBytes[changedBytes.length - 2] ^= 1;
const changedDownload = verifyMarketplaceCatalogPackage({ entry: verifiedCatalog.verified.catalog.entries[0], bytes: changedBytes, trustStore });
assert.equal(changedDownload.ok, false, 'download byte tampering must be rejected before package parsing');
if (!changedDownload.ok) assert.equal(changedDownload.code, 'package_file_digest_mismatch');
const mismatchedListing = verifyMarketplaceCatalogPackage({
  entry: { ...verifiedCatalog.verified.catalog.entries[0], asset_name: 'Different catalog identity' },
  bytes: cameraPackageBytes,
  trustStore
});
assert.equal(mismatchedListing.ok, false, 'catalog/package metadata divergence must be rejected rather than repaired');
if (!mismatchedListing.ok) assert.equal(mismatchedListing.code, 'package_catalog_metadata_mismatch');
assert.equal(verifyMarketplaceCatalog(signedCatalog.catalog, trustStore.map((entry) => ({ ...entry, revoked: true })), '2026-07-16T10:30:00.000Z').ok, false,
  'revoked catalog publishers must immediately lose catalog authority');
const cameraInstalled = installMarketplacePackage({
  rawPackage: cameraPackage,
  trustStore,
  existingRecords: [],
  confirmed: true,
  now: '2026-07-16T10:02:10.000Z'
});
if (!cameraInstalled.ok || !cameraInstalled.record) throw new Error(cameraInstalled.ok ? 'missing camera record' : cameraInstalled.detail);
const cameraEnabled = enableMarketplaceSimulation({
  record: cameraInstalled.record,
  trustStore,
  existingRecords: cameraInstalled.records,
  confirmed: true,
  now: '2026-07-16T10:02:20.000Z'
});
if (!cameraEnabled.ok || !cameraEnabled.record) throw new Error(cameraEnabled.ok ? 'missing enabled camera record' : cameraEnabled.detail);
const runtimeCameraAsset = marketplaceRuntimeAsset(cameraEnabled.record, trustStore);
if (!runtimeCameraAsset) throw new Error('verified enabled camera asset was not runtime-visible');
const runtimeCamera: VerifiedMarketplaceRuntimeAsset = {
  packageId: cameraEnabled.record.packageId,
  packageVersion: cameraEnabled.record.packageVersion,
  digestSha256: cameraEnabled.record.digestSha256,
  trustTier: cameraEnabled.record.trustTier,
  publisherName: cameraEnabled.record.publisherName,
  asset: runtimeCameraAsset,
  executionAuthorityGranted: false,
  realAdapterEnabled: false
};
const boundCamera = bindMarketplaceAssetToVirtualLab({ runtimeAsset: runtimeCamera, templateAsset: cameraTemplate() });
assert.equal(boundCamera.ok, true, 'exact signed semantic capabilities should bind to a trusted simulation geometry template');
assert.deepEqual(boundCamera.asset.deviceMeta.capabilities, ['capture_frame', 'read_sensor', 'scan_area'],
  'binding must preserve the exact signed capability set and order');
assert.equal(boundCamera.asset.adapterManifest.real_device_enabled, false);
assert.deepEqual(boundCamera.asset.deviceMeta.supported_adapters, ['simulator']);
assert.match(boundCamera.asset.deviceMeta.simulator_fidelity?.limitations[0] ?? '', /not vendor CAD or physical proof/,
  'template geometry limitations must remain explicit');
const cameraReference = marketplaceWorkspaceReference(runtimeCamera, boundCamera.asset);
assert.deepEqual(cameraReference, {
  package_id: runtimeCamera.packageId,
  package_version: runtimeCamera.packageVersion,
  digest_sha256: runtimeCamera.digestSha256,
  signed_asset_id: runtimeCamera.asset.assetId,
  workspace_asset_id: boundCamera.asset.manifest.asset_id
}, 'project persistence must retain only the signed identity and digest-bound workspace id');
assert.equal(marketplaceWorkspaceReference(runtimeCamera, { ...boundCamera.asset, adapterManifest: { ...boundCamera.asset.adapterManifest, real_device_enabled: true } }), null,
  'a derived asset with real authority can never produce a persistence reference');
const reconciled = removeUnavailableMarketplaceWorkspaceDevices(
  [{ assetId: boundCamera.asset.manifest.asset_id }, { assetId: 'ordinary-import' }],
  new Set<string>()
);
assert.deepEqual(reconciled.devices, [{ assetId: 'ordinary-import' }], 'revoked or uninstalled Marketplace devices must leave no workspace residue');
assert.deepEqual(reconciled.removedAssetIds, [boundCamera.asset.manifest.asset_id]);

const unsupportedDeviceBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: { ...runtimeCamera, asset }, templateAsset: cameraTemplate() });
assert.equal(unsupportedDeviceBinding.ok, false, 'unknown device types must be refused instead of coerced into a template');
if (!unsupportedDeviceBinding.ok) assert.equal(unsupportedDeviceBinding.code, 'device_type_unsupported');

const aliasAsset = cameraMarketplaceAsset();
aliasAsset.deviceManifest.capabilities[0].id = 'capture_image';
aliasAsset.capabilityContracts[0].id = 'capture_image';
const aliasBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: { ...runtimeCamera, asset: aliasAsset }, templateAsset: cameraTemplate() });
assert.equal(aliasBinding.ok, false, 'capability aliases must be refused, never translated');
if (!aliasBinding.ok) assert.equal(aliasBinding.code, 'capability_unsupported');

const narrowedTemplate = cameraTemplate();
narrowedTemplate.adapterManifest.supported_commands = ['capture_frame', 'read_sensor'];
const narrowingBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: runtimeCamera, templateAsset: narrowedTemplate });
assert.equal(narrowingBinding.ok, false, 'unsupported signed capabilities must reject the whole asset, never be intersected away');
if (!narrowingBinding.ok) assert.equal(narrowingBinding.code, 'template_capability_mismatch');

const profileNarrowedTemplate = cameraTemplate();
profileNarrowedTemplate.deviceMeta.capabilities = ['capture_frame', 'read_sensor'];
const profileNarrowingBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: runtimeCamera, templateAsset: profileNarrowedTemplate });
assert.equal(profileNarrowingBinding.ok, false, 'adapter support cannot replace the trusted profile capability declaration');
if (!profileNarrowingBinding.ok) assert.equal(profileNarrowingBinding.code, 'template_capability_mismatch');

const fasterAsset = cameraMarketplaceAsset();
fasterAsset.deviceManifest.constraints.maxSpeed = 'fast';
const fasterBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: { ...runtimeCamera, asset: fasterAsset }, templateAsset: cameraTemplate() });
assert.equal(fasterBinding.ok, false, 'publisher constraints may never loosen trusted-template speed and must not be clamped');
if (!fasterBinding.ok) assert.equal(fasterBinding.code, 'template_safety_loosened');

const strongerAsset = cameraMarketplaceAsset();
strongerAsset.deviceManifest.constraints.maxForce = 'high';
const strongerBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: { ...runtimeCamera, asset: strongerAsset }, templateAsset: cameraTemplate() });
assert.equal(strongerBinding.ok, false, 'publisher constraints may never loosen trusted-template force and must not be clamped');
if (!strongerBinding.ok) assert.equal(strongerBinding.code, 'template_safety_loosened');

const omittedForbiddenAsset = cameraMarketplaceAsset();
omittedForbiddenAsset.deviceManifest.workspace.forbiddenZones = [];
const omittedForbiddenBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: { ...runtimeCamera, asset: omittedForbiddenAsset }, templateAsset: cameraTemplate() });
assert.equal(omittedForbiddenBinding.ok, false, 'publisher workspace policy may never omit a trusted-template forbidden zone');
if (!omittedForbiddenBinding.ok) assert.equal(omittedForbiddenBinding.code, 'template_safety_loosened');

const allowedForbiddenAsset = cameraMarketplaceAsset();
allowedForbiddenAsset.deviceManifest.workspace.allowedZones = ['camera_view', 'privacy_zone'];
allowedForbiddenAsset.deviceManifest.workspace.forbiddenZones = [];
const allowedForbiddenBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: { ...runtimeCamera, asset: allowedForbiddenAsset }, templateAsset: cameraTemplate() });
assert.equal(allowedForbiddenBinding.ok, false, 'publisher allowed zones may never reclassify a trusted forbidden zone');
if (!allowedForbiddenBinding.ok) assert.equal(allowedForbiddenBinding.code, 'template_safety_loosened');

const unknownZoneAsset = cameraMarketplaceAsset();
unknownZoneAsset.deviceManifest.workspace.allowedZones = ['unreviewed_zone'];
unknownZoneAsset.worldModelAssumptions.zones.push({ id: 'unreviewed_zone', label: 'Unreviewed', safe: true });
const unknownZoneBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: { ...runtimeCamera, asset: unknownZoneAsset }, templateAsset: cameraTemplate() });
assert.equal(unknownZoneBinding.ok, false, 'signed zones without trusted geometry must reject the complete binding');
if (!unknownZoneBinding.ok) assert.equal(unknownZoneBinding.code, 'template_zone_mismatch');

const wrongTemplate = cameraTemplate();
wrongTemplate.manifest.device_type = 'sensor_box';
const wrongTemplateBinding = bindMarketplaceAssetToVirtualLab({ runtimeAsset: runtimeCamera, templateAsset: wrongTemplate });
assert.equal(wrongTemplateBinding.ok, false, 'a different device-type template must never be used as fallback');
if (!wrongTemplateBinding.ok) assert.equal(wrongTemplateBinding.code, 'template_type_mismatch');

const authorityBinding = bindMarketplaceAssetToVirtualLab({
  runtimeAsset: { ...runtimeCamera, executionAuthorityGranted: true } as unknown as VerifiedMarketplaceRuntimeAsset,
  templateAsset: cameraTemplate()
});
assert.equal(authorityBinding.ok, false, 'any runtime authority escalation must refuse workspace binding');
if (!authorityBinding.ok) assert.equal(authorityBinding.code, 'authority_rejected');

const malformedBinding = bindMarketplaceAssetToVirtualLab({
  runtimeAsset: { ...runtimeCamera, asset: { ...runtimeCamera.asset, capabilityContracts: null } as unknown as RealityAssetPackage },
  templateAsset: cameraTemplate()
});
assert.equal(malformedBinding.ok, false, 'malformed nested runtime input must fail closed without throwing');

const removed = uninstallMarketplacePackage({
  packageId: enabled.record.packageId,
  existingRecords: enabled.records,
  confirmed: true,
  now: '2026-07-16T10:03:00.000Z'
});
if (!removed.ok) throw new Error(removed.detail);
assert.equal(removed.ok, true, 'explicit uninstall should succeed');
assert.equal(removed.records.length, 0, 'uninstall must leave no residual package record or runtime capability');
assert.equal(removed.audit.nextState, 'not_installed');
assert.equal(removed.audit.hardwareSignalSent, false);

const tampered = JSON.parse(JSON.stringify(valid)) as MarketplacePackage;
tampered.asset.description = 'tampered after review';
const tamperedResult = verifyMarketplacePackage(tampered, trustStore);
assert.equal(tamperedResult.ok, false, 'post-signature asset tampering must be rejected');
if (!tamperedResult.ok) assert.equal(tamperedResult.code, 'signature_mismatch');

const selfPromoted = { ...valid, trust_tier: 'official' };
const selfPromotedResult = verifyMarketplacePackage(selfPromoted, trustStore);
assert.equal(selfPromotedResult.ok, false, 'package cannot self-declare a trust tier');
if (!selfPromotedResult.ok) assert.equal(selfPromotedResult.code, 'schema_rejected');

const unknownPublisher = signedPackage(asset, {
  key: unknownKeys.privateKey,
  keyId: 'unknown.publisher.v1',
  displayName: 'Unknown Publisher',
  packageId: 'fixture.unknown-publisher'
});
const unknownResult = verifyMarketplacePackage(unknownPublisher, trustStore);
assert.equal(unknownResult.ok, false, 'unknown publisher keys must be rejected');
if (!unknownResult.ok) assert.equal(unknownResult.code, 'publisher_untrusted');

const revokedStore = trustStore.map((entry) => ({ ...entry, revoked: entry.keyId === 'realitywarden.official.v1' }));
const revokedResult = verifyMarketplacePackage(valid, revokedStore);
assert.equal(revokedResult.ok, false, 'revoked publisher keys must be rejected');
if (!revokedResult.ok) assert.equal(revokedResult.code, 'publisher_revoked');
assert.equal(marketplaceRuntimeAsset(cameraEnabled.record, revokedStore), null,
  'publisher revocation must remove the raw asset from runtime visibility as well as its runtime manifest');

const executableAsset = { ...asset, postinstall: 'powershell -enc ...' } as RealityAssetPackage;
const executableEnvelope = { ...valid, package_id: 'fixture.executable', asset: executableAsset };
const executableResult = verifyMarketplacePackage(executableEnvelope, trustStore);
assert.equal(executableResult.ok, false, 'executable metadata must be rejected before signature trust is considered');
if (!executableResult.ok) assert.equal(executableResult.code, 'non_declarative_content');

const unknownAssetField = { ...asset, marketingTrustTier: 'official' } as RealityAssetPackage;
const unknownAssetFieldResult = verifyMarketplacePackage(signedPackage(unknownAssetField, { packageId: 'fixture.unknown-field' }), trustStore);
assert.equal(unknownAssetFieldResult.ok, false, 'unknown asset fields must be rejected rather than stripped or displayed as authority');
if (!unknownAssetFieldResult.ok) assert.equal(unknownAssetFieldResult.code, 'asset_rejected');

const malformedAsset = { ...asset, deviceManifest: null } as unknown as RealityAssetPackage;
const malformedResult = verifyMarketplacePackage(signedPackage(malformedAsset, { packageId: 'fixture.malformed' }), trustStore);
assert.equal(malformedResult.ok, false, 'signed malformed asset shapes must fail closed without crashing validation');
if (!malformedResult.ok) assert.equal(malformedResult.code, 'asset_rejected');

const unsafeAsset = {
  ...asset,
  adapterBoundary: { ...asset.adapterBoundary, realAdapterEnabled: true },
  deviceManifest: { ...asset.deviceManifest, adapter: { ...asset.deviceManifest.adapter, realAdapterEnabled: true } }
};
const unsafeResult = verifyMarketplacePackage(signedPackage(unsafeAsset, { packageId: 'fixture.unsafe' }), trustStore);
assert.equal(unsafeResult.ok, false, 'official signature must not override real-adapter safety rejection');
if (!unsafeResult.ok) assert.equal(unsafeResult.code, 'asset_rejected');
const unsafeDraft = { ...reviewedDraft, package_id: 'fixture.unsafe-signing', asset: unsafeAsset };
const unsafeSigning = signMarketplacePackage(
  unsafeDraft,
  officialKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
);
assert.equal(unsafeSigning.ok, false, 'maintainer signing must refuse unsafe drafts before emitting a signature');

const duplicate = installMarketplacePackage({ rawPackage: valid, trustStore, existingRecords: installed.records, confirmed: true });
assert.equal(duplicate.ok, false, 'installed identities must never be overwritten');
if (!duplicate.ok) assert.match(duplicate.detail, /overwrite is refused/);
assert.equal(installed.records.length, 1, 'duplicate refusal must be atomic');

const tamperedRecord = { ...installed.record, executionAuthorityGranted: true } as unknown as MarketplaceInstallRecord;
assert.equal(marketplaceRuntimeManifest(tamperedRecord, trustStore), null, 'stored-record tampering cannot grant execution authority');

const community = signedPackage(asset, {
  key: communityKeys.privateKey,
  keyId: 'community.fixture.v1',
  displayName: 'Fixture Community Publisher',
  packageId: 'fixture.community-fan'
});
const communityResult = verifyMarketplacePackage(community, trustStore);
assert.equal(communityResult.ok, true);
if (communityResult.ok) assert.equal(communityResult.verified.trustTier, 'community', 'community signature stays visibly community-tier');

const communityProposal = {
  schema: 'realitywarden.community-publisher-key',
  schema_version: 1,
  key_id: 'community.imported.v1',
  display_name: 'Imported Community Publisher',
  public_key_pem: unknownKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString()
};
assert.equal(trustCommunityPublisher({ raw: communityProposal, existingEntries: trustStore, confirmed: false }).ok, false,
  'community trust import requires explicit confirmation');
const importedTrust = trustCommunityPublisher({ raw: communityProposal, existingEntries: trustStore, confirmed: true });
if (!importedTrust.ok) throw new Error(importedTrust.detail);
assert.equal(importedTrust.entry.trustTier, 'community', 'an imported publisher can never self-promote above community');
assert.match(importedTrust.fingerprintSha256, /^[a-f0-9]{64}$/);
assert.equal(trustCommunityPublisher({
  raw: { ...communityProposal, trust_tier: 'official' },
  existingEntries: trustStore,
  confirmed: true
}).ok, false, 'unknown authority fields must be rejected');
assert.equal(trustCommunityPublisher({ raw: communityProposal, existingEntries: importedTrust.entries, confirmed: true }).ok, false,
  'duplicate publisher identities must be rejected');
assert.equal(revokeCommunityPublisher({ keyId: importedTrust.entry.keyId, existingEntries: importedTrust.entries, confirmed: false }).ok, false,
  'publisher revocation requires explicit confirmation');
const revokedCommunity = revokeCommunityPublisher({ keyId: importedTrust.entry.keyId, existingEntries: importedTrust.entries, confirmed: true });
if (!revokedCommunity.ok) throw new Error(revokedCommunity.detail);
assert.equal(revokedCommunity.entries.find((entry) => entry.keyId === importedTrust.entry.keyId)?.revoked, true);
assert.equal(revokeCommunityPublisher({ keyId: 'realitywarden.official.v1', existingEntries: trustStore, confirmed: true }).ok, false,
  'local UI cannot revoke or replace bundled official trust');

const importedCommunityPackage = signedPackage(asset, {
  key: unknownKeys.privateKey,
  keyId: 'community.imported.v1',
  displayName: 'Imported Community Publisher',
  packageId: 'fixture.imported-community-fan'
});
const importedInstalled = installMarketplacePackage({
  rawPackage: importedCommunityPackage,
  trustStore: importedTrust.entries,
  existingRecords: [],
  confirmed: true,
  now: '2026-07-16T10:04:00.000Z'
});
if (!importedInstalled.ok || !importedInstalled.record) throw new Error(importedInstalled.ok ? 'missing record' : importedInstalled.detail);
const importedEnabled = enableMarketplaceSimulation({
  record: importedInstalled.record,
  trustStore: importedTrust.entries,
  existingRecords: importedInstalled.records,
  confirmed: true,
  now: '2026-07-16T10:05:00.000Z'
});
if (!importedEnabled.ok || !importedEnabled.record) throw new Error(importedEnabled.ok ? 'missing record' : importedEnabled.detail);
assert.notEqual(marketplaceRuntimeManifest(importedEnabled.record, importedTrust.entries), null);
assert.equal(marketplaceRuntimeManifest(importedEnabled.record, revokedCommunity.entries), null,
  'revoking a community publisher must immediately remove its enabled assets from runtime visibility');

const durableState = {
  ...createEmptyMarketplaceState(),
  communityTrustEntries: revokedCommunity.entries.filter((entry) => entry.keyId === 'community.imported.v1'),
  records: [importedEnabled.record],
  audit: [importedInstalled.audit, importedEnabled.audit]
};
const restoredState = restoreMarketplaceState(JSON.parse(serializeMarketplaceState(durableState)), trustStore);
if (!restoredState.ok) throw new Error(restoredState.detail);
assert.equal(restoredState.state.records.length, 1);
assert.equal(marketplaceRuntimeManifest(restoredState.state.records[0], restoredState.trustStore), null,
  'revoked publisher state may be retained for removal and audit but must restore inert');

const metadataTamper = JSON.parse(JSON.stringify(durableState));
metadataTamper.records[0].publisherName = 'Forged Review Board';
assert.equal(restoreMarketplaceState(metadataTamper, trustStore).ok, false,
  'persisted metadata tampering must reject the entire state');
const packageTamper = JSON.parse(JSON.stringify(durableState));
packageTamper.records[0].package.asset.description = 'changed on disk';
assert.equal(restoreMarketplaceState(packageTamper, trustStore).ok, false,
  'persisted signed-package tampering must reject the entire state');
const authorityTamper = JSON.parse(JSON.stringify(durableState));
authorityTamper.records[0].executionAuthorityGranted = true;
assert.equal(restoreMarketplaceState(authorityTamper, trustStore).ok, false,
  'persisted execution-authority escalation must reject the entire state');
const unknownStateField = { ...durableState, silentlyRepairMe: true };
assert.equal(restoreMarketplaceState(unknownStateField, trustStore).ok, false,
  'unknown persisted state fields must fail closed rather than be stripped');
const duplicateRecords = { ...durableState, records: [importedEnabled.record, importedEnabled.record] };
assert.equal(restoreMarketplaceState(duplicateRecords, trustStore).ok, false,
  'duplicate persisted identities must reject atomically');

console.log('Marketplace trust-boundary, distribution, signed catalog, and Virtual Lab binding tests passed (76 cases).');
console.log('- Signature provenance never overrides declarative safety validation.');
console.log('- Trust tiers are local policy, installs default disabled, and simulation requires a second confirmation.');
console.log('- Uninstall removes the package record and runtime visibility with honest zero-signal audit.');
