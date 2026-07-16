import { strict as assert } from 'node:assert';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  enableMarketplaceSimulation,
  installMarketplacePackage,
  marketplaceRuntimeManifest,
  marketplaceSigningPayload,
  signMarketplacePackage,
  uninstallMarketplacePackage,
  verifyMarketplacePackage,
  type MarketplaceInstallRecord,
  type MarketplacePackage,
  type MarketplaceTrustEntry
} from '../../lib/marketplace';
import type { RealityAssetPackage } from '../../lib/reality-assets';

const asset = JSON.parse(readFileSync('examples/reality-assets/desktop_fan.asset.json', 'utf8').replace(/^\uFEFF/, '')) as RealityAssetPackage;
const officialKeys = generateKeyPairSync('ed25519');
const communityKeys = generateKeyPairSync('ed25519');
const unknownKeys = generateKeyPairSync('ed25519');

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
assert.equal(marketplaceRuntimeManifest(installed.record), null, 'disabled package must not enter runtime');

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
assert.equal(marketplaceRuntimeManifest(enabled.record)?.deviceId, asset.deviceManifest.deviceId);
assert.equal(enabled.audit.hardwareSignalSent, false);

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
assert.equal(marketplaceRuntimeManifest(tamperedRecord), null, 'stored-record tampering cannot grant execution authority');

const community = signedPackage(asset, {
  key: communityKeys.privateKey,
  keyId: 'community.fixture.v1',
  displayName: 'Fixture Community Publisher',
  packageId: 'fixture.community-fan'
});
const communityResult = verifyMarketplacePackage(community, trustStore);
assert.equal(communityResult.ok, true);
if (communityResult.ok) assert.equal(communityResult.verified.trustTier, 'community', 'community signature stays visibly community-tier');

console.log('Marketplace trust-boundary tests passed (20 cases).');
console.log('- Signature provenance never overrides declarative safety validation.');
console.log('- Trust tiers are local policy, installs default disabled, and simulation requires a second confirmation.');
console.log('- Uninstall removes the package record and runtime visibility with honest zero-signal audit.');
