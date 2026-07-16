import { getBuiltinRealityAssets } from '../reality-assets/assetRegistry';
import { toRuntimeDeviceManifest } from '../reality-assets/runtimeBridge';
import type { DeviceManifest } from '../open-reality-runtime/types';
import type { RealityAssetPackage } from '../reality-assets/types';
import {
  verifyMarketplacePackage,
  type MarketplacePackage,
  type MarketplaceTrustEntry,
  type MarketplaceTrustTier
} from './MarketplacePackage';

export type MarketplaceInstallState = 'installed_disabled' | 'simulation_enabled';

export interface MarketplaceInstallRecord {
  packageId: string;
  packageVersion: string;
  assetId: string;
  digestSha256: string;
  trustTier: MarketplaceTrustTier;
  publisherName: string;
  state: MarketplaceInstallState;
  installedAt: string;
  simulationEnabledAt: string | null;
  package: MarketplacePackage;
  executionAuthorityGranted: false;
  realAdapterEnabled: false;
}

export interface MarketplaceAuditEvent {
  eventType: 'install_disabled' | 'enable_simulation' | 'uninstall';
  packageId: string;
  assetId: string;
  digestSha256: string;
  occurredAt: string;
  previousState: MarketplaceInstallState | 'not_installed';
  nextState: MarketplaceInstallState | 'not_installed';
  hardwareSignalSent: false;
  executionAuthorityGranted: false;
}

export type MarketplaceMutationResult =
  | { ok: true; records: MarketplaceInstallRecord[]; record?: MarketplaceInstallRecord; audit: MarketplaceAuditEvent }
  | { ok: false; detail: string };

function validTimestamp(now: string): boolean {
  return !Number.isNaN(Date.parse(now)) && new Date(now).toISOString() === now;
}

function audit(
  eventType: MarketplaceAuditEvent['eventType'],
  record: MarketplaceInstallRecord,
  occurredAt: string,
  previousState: MarketplaceAuditEvent['previousState'],
  nextState: MarketplaceAuditEvent['nextState']
): MarketplaceAuditEvent {
  return {
    eventType,
    packageId: record.packageId,
    assetId: record.assetId,
    digestSha256: record.digestSha256,
    occurredAt,
    previousState,
    nextState,
    hardwareSignalSent: false,
    executionAuthorityGranted: false
  };
}

export function installMarketplacePackage(input: {
  rawPackage: unknown;
  trustStore: readonly MarketplaceTrustEntry[];
  existingRecords: readonly MarketplaceInstallRecord[];
  confirmed: boolean;
  now?: string;
}): MarketplaceMutationResult {
  if (input.confirmed !== true) return { ok: false, detail: 'explicit marketplace installation confirmation is required' };
  const now = input.now ?? new Date().toISOString();
  if (!validTimestamp(now)) return { ok: false, detail: 'installation timestamp must be an ISO timestamp' };
  const checked = verifyMarketplacePackage(input.rawPackage, input.trustStore);
  if (!checked.ok) return { ok: false, detail: `${checked.code}: ${checked.detail}` };
  const pkg = checked.verified.package;
  if (input.existingRecords.some((record) => record.packageId === pkg.package_id || record.assetId === pkg.asset.assetId)) {
    return { ok: false, detail: 'package or asset identity is already installed; overwrite is refused' };
  }
  if (getBuiltinRealityAssets().some((asset) => asset.assetId === pkg.asset.assetId)) {
    return { ok: false, detail: 'marketplace package cannot override a built-in Reality Asset' };
  }
  const record: MarketplaceInstallRecord = {
    packageId: pkg.package_id,
    packageVersion: pkg.package_version,
    assetId: pkg.asset.assetId,
    digestSha256: checked.verified.digestSha256,
    trustTier: checked.verified.trustTier,
    publisherName: checked.verified.trustedPublisherName,
    state: 'installed_disabled',
    installedAt: now,
    simulationEnabledAt: null,
    package: pkg,
    executionAuthorityGranted: false,
    realAdapterEnabled: false
  };
  return {
    ok: true,
    records: [...input.existingRecords, record],
    record,
    audit: audit('install_disabled', record, now, 'not_installed', 'installed_disabled')
  };
}

export function enableMarketplaceSimulation(input: {
  record: MarketplaceInstallRecord;
  trustStore: readonly MarketplaceTrustEntry[];
  existingRecords: readonly MarketplaceInstallRecord[];
  confirmed: boolean;
  now?: string;
}): MarketplaceMutationResult {
  if (input.confirmed !== true) return { ok: false, detail: 'explicit simulation enablement confirmation is required' };
  const now = input.now ?? new Date().toISOString();
  if (!validTimestamp(now)) return { ok: false, detail: 'enablement timestamp must be an ISO timestamp' };
  const stored = input.existingRecords.find((candidate) => candidate.packageId === input.record.packageId);
  if (!stored || stored !== input.record) return { ok: false, detail: 'enablement requires the exact installed record' };
  if (stored.state !== 'installed_disabled') return { ok: false, detail: 'package is not in the disabled installation state' };
  const checked = verifyMarketplacePackage(stored.package, input.trustStore);
  if (!checked.ok || checked.verified.digestSha256 !== stored.digestSha256) {
    return { ok: false, detail: `stored package revalidation failed: ${checked.ok ? 'digest mismatch' : `${checked.code}: ${checked.detail}`}` };
  }
  const asset = checked.verified.package.asset;
  if (asset.supportLevel !== 'simulation_only' || asset.adapterBoundary.simulationAdapterAvailable !== true || asset.adapterBoundary.adapterMode !== 'simulation_only') {
    return { ok: false, detail: 'only a validated simulation_only asset can pass marketplace simulation enablement' };
  }
  const enabled: MarketplaceInstallRecord = {
    ...stored,
    state: 'simulation_enabled',
    simulationEnabledAt: now,
    executionAuthorityGranted: false,
    realAdapterEnabled: false
  };
  return {
    ok: true,
    records: input.existingRecords.map((record) => record === stored ? enabled : record),
    record: enabled,
    audit: audit('enable_simulation', enabled, now, 'installed_disabled', 'simulation_enabled')
  };
}

export function marketplaceRuntimeManifest(
  record: MarketplaceInstallRecord,
  trustStore: readonly MarketplaceTrustEntry[]
): DeviceManifest | null {
  if (record.state !== 'simulation_enabled') return null;
  if (record.executionAuthorityGranted !== false || record.realAdapterEnabled !== false) return null;
  const checked = verifyMarketplacePackage(record.package, trustStore);
  if (!checked.ok) return null;
  if (
    checked.verified.digestSha256 !== record.digestSha256
    || checked.verified.trustTier !== record.trustTier
    || checked.verified.trustedPublisherName !== record.publisherName
    || checked.verified.package.package_id !== record.packageId
    || checked.verified.package.package_version !== record.packageVersion
    || checked.verified.package.asset.assetId !== record.assetId
  ) return null;
  return toRuntimeDeviceManifest(checked.verified.package.asset);
}

export function marketplaceRuntimeAsset(
  record: MarketplaceInstallRecord,
  trustStore: readonly MarketplaceTrustEntry[]
): RealityAssetPackage | null {
  if (!marketplaceRuntimeManifest(record, trustStore)) return null;
  const checked = verifyMarketplacePackage(record.package, trustStore);
  return checked.ok ? checked.verified.package.asset : null;
}

export function uninstallMarketplacePackage(input: {
  packageId: string;
  existingRecords: readonly MarketplaceInstallRecord[];
  confirmed: boolean;
  now?: string;
}): MarketplaceMutationResult {
  if (input.confirmed !== true) return { ok: false, detail: 'explicit marketplace uninstall confirmation is required' };
  const now = input.now ?? new Date().toISOString();
  if (!validTimestamp(now)) return { ok: false, detail: 'uninstall timestamp must be an ISO timestamp' };
  const record = input.existingRecords.find((candidate) => candidate.packageId === input.packageId);
  if (!record) return { ok: false, detail: 'package is not installed' };
  return {
    ok: true,
    records: input.existingRecords.filter((candidate) => candidate.packageId !== input.packageId),
    audit: audit('uninstall', record, now, record.state, 'not_installed')
  };
}
