import { app, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_ROOT = path.join(__dirname, '..', '..');
const PACKAGED_APP_ROOT = app.isPackaged ? path.join(process.resourcesPath, 'app.asar') : APP_ROOT;
const RUNTIME_MARKETPLACE = path.join(PACKAGED_APP_ROOT, 'dist-electron-runtime', 'lib', 'marketplace');
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

interface TrustEntry {
  keyId: string;
  displayName: string;
  publicKeyPem: string;
  trustTier: 'official' | 'verified' | 'community';
  revoked: boolean;
}

interface PersistentState {
  schema: 'realitywarden.marketplace-state';
  schema_version: 1;
  communityTrustEntries: TrustEntry[];
  records: Array<Record<string, unknown> & {
    packageId: string;
    packageVersion: string;
    assetId: string;
    digestSha256: string;
    trustTier: 'official' | 'verified' | 'community';
    publisherName: string;
    state: 'installed_disabled' | 'simulation_enabled';
    executionAuthorityGranted: false;
    realAdapterEnabled: false;
  }>;
  audit: unknown[];
}

interface MarketplaceRuntimeModule {
  createEmptyMarketplaceState(): PersistentState;
  restoreMarketplaceState(raw: unknown, bundled: readonly TrustEntry[]):
    | { ok: true; state: PersistentState; trustStore: TrustEntry[] }
    | { ok: false; detail: string };
  serializeMarketplaceState(state: PersistentState): string;
  verifyMarketplacePackage(raw: unknown, trustStore: readonly TrustEntry[]):
    | { ok: true; verified: { package: Record<string, unknown> & { package_id: string; package_version: string; asset: Record<string, unknown> & { assetId: string; name: string } }; digestSha256: string; trustTier: string; trustedPublisherName: string } }
    | { ok: false; code: string; detail: string };
  installMarketplacePackage(input: Record<string, unknown>): MutationResult;
  enableMarketplaceSimulation(input: Record<string, unknown>): MutationResult;
  marketplaceRuntimeAsset(record: PersistentState['records'][number], trustStore: readonly TrustEntry[]): unknown | null;
  uninstallMarketplacePackage(input: Record<string, unknown>): MutationResult;
  trustCommunityPublisher(input: Record<string, unknown>):
    | { ok: true; entries: TrustEntry[]; entry: TrustEntry; fingerprintSha256: string }
    | { ok: false; detail: string };
  revokeCommunityPublisher(input: Record<string, unknown>):
    | { ok: true; entries: TrustEntry[] }
    | { ok: false; detail: string };
}

type MutationResult =
  | { ok: true; records: PersistentState['records']; record?: PersistentState['records'][number]; audit: unknown }
  | { ok: false; detail: string };

// Production official/verified keys must arrive through a signed app update.
// An empty store is honest until release engineering provisions those keys.
const BUNDLED_MARKETPLACE_TRUST: readonly TrustEntry[] = [];

function loadRuntime(): MarketplaceRuntimeModule | { error: string } {
  try {
    // Main-process policy comes from the compiled shared authority. Never
    // import lib/ directly and never copy signature or validation semantics.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(RUNTIME_MARKETPLACE) as MarketplaceRuntimeModule;
  } catch (error) {
    return { error: `marketplace_authority_unavailable: rebuild desktop runtime. Underlying: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function readJsonFile(filePath: string): unknown {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > MAX_IMPORT_BYTES) throw new Error(`file must be a JSON file no larger than ${MAX_IMPORT_BYTES} bytes`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as unknown;
}

class MarketplaceDesktopStore {
  private initialized = false;
  private state: PersistentState | null = null;
  private trustStore: TrustEntry[] = [];
  private blockedError: string | null = null;
  private quarantinedPath: string | null = null;

  private statePath() {
    return path.join(app.getPath('userData'), 'marketplace-state.json');
  }

  private initialize() {
    if (this.initialized) return;
    this.initialized = true;
    const runtime = loadRuntime();
    if ('error' in runtime) {
      this.blockedError = runtime.error;
      return;
    }
    const filePath = this.statePath();
    if (!fs.existsSync(filePath)) {
      this.state = runtime.createEmptyMarketplaceState();
      this.trustStore = [...BUNDLED_MARKETPLACE_TRUST];
      return;
    }
    try {
      const restored = runtime.restoreMarketplaceState(readJsonFile(filePath), BUNDLED_MARKETPLACE_TRUST);
      if (!restored.ok) throw new Error(restored.detail);
      this.state = restored.state;
      this.trustStore = restored.trustStore;
    } catch (error) {
      const quarantine = `${filePath}.corrupt-${timestampSuffix()}`;
      try {
        fs.renameSync(filePath, quarantine);
        this.quarantinedPath = quarantine;
      } catch (quarantineError) {
        this.blockedError = `marketplace state rejected and quarantine failed: ${error instanceof Error ? error.message : String(error)}; quarantine: ${quarantineError instanceof Error ? quarantineError.message : String(quarantineError)}`;
        return;
      }
      this.blockedError = `marketplace state rejected and quarantined; explicit reset is required: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  snapshot() {
    this.initialize();
    if (this.blockedError || !this.state) {
      return { ok: false, error: this.blockedError ?? 'marketplace state unavailable', quarantinedPath: this.quarantinedPath, records: [], communityTrustEntries: [] };
    }
    return { ok: true, records: this.state.records, communityTrustEntries: this.state.communityTrustEntries, audit: this.state.audit };
  }

  runtimeAssets() {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const assets: Array<Record<string, unknown>> = [];
    const rejected: Array<{ packageId: string; detail: string }> = [];
    for (const record of ready.state.records) {
      if (record.state !== 'simulation_enabled') continue;
      const asset = ready.runtime.marketplaceRuntimeAsset(record, this.trustStore);
      if (!asset) {
        rejected.push({
          packageId: record.packageId,
          detail: 'Enabled package was refused by current signature, digest, trust, or stored-metadata policy.'
        });
        continue;
      }
      assets.push({
        packageId: record.packageId,
        packageVersion: record.packageVersion,
        digestSha256: record.digestSha256,
        trustTier: record.trustTier,
        publisherName: record.publisherName,
        asset,
        executionAuthorityGranted: false,
        realAdapterEnabled: false
      });
    }
    return { ok: true, assets, rejected };
  }

  private ready() {
    this.initialize();
    const runtime = loadRuntime();
    if ('error' in runtime) return { ok: false as const, error: runtime.error };
    if (this.blockedError || !this.state) return { ok: false as const, error: this.blockedError ?? 'marketplace state unavailable' };
    return { ok: true as const, runtime, state: this.state };
  }

  private persist(runtime: MarketplaceRuntimeModule, next: PersistentState) {
    const filePath = this.statePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    const handle = fs.openSync(tempPath, 'wx');
    try {
      fs.writeFileSync(handle, runtime.serializeMarketplaceState(next), 'utf8');
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    try {
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch { /* preserve the original persistence error */ }
      throw error;
    }
    this.state = next;
  }

  reviewPackage(raw: unknown) {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const checked = ready.runtime.verifyMarketplacePackage(raw, this.trustStore);
    if (!checked.ok) return { ok: false, error: `${checked.code}: ${checked.detail}` };
    return {
      ok: true,
      rawPackage: checked.verified.package,
      summary: {
        packageId: checked.verified.package.package_id,
        packageVersion: checked.verified.package.package_version,
        assetId: checked.verified.package.asset.assetId,
        assetName: checked.verified.package.asset.name,
        digestSha256: checked.verified.digestSha256,
        trustTier: checked.verified.trustTier,
        publisherName: checked.verified.trustedPublisherName,
        executionAuthorityGranted: false,
        realAdapterEnabled: false
      }
    };
  }

  install(rawPackage: unknown, confirmed: boolean) {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const result = ready.runtime.installMarketplacePackage({ rawPackage, trustStore: this.trustStore, existingRecords: ready.state.records, confirmed });
    if (!result.ok) return { ok: false, error: result.detail };
    const next = { ...ready.state, records: result.records, audit: [...ready.state.audit, result.audit] };
    this.persist(ready.runtime, next);
    return { ok: true, record: result.record, state: this.snapshot() };
  }

  enable(packageId: string, confirmed: boolean) {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const record = ready.state.records.find((candidate) => candidate.packageId === packageId);
    if (!record) return { ok: false, error: 'package is not installed' };
    const result = ready.runtime.enableMarketplaceSimulation({ record, trustStore: this.trustStore, existingRecords: ready.state.records, confirmed });
    if (!result.ok) return { ok: false, error: result.detail };
    const next = { ...ready.state, records: result.records, audit: [...ready.state.audit, result.audit] };
    this.persist(ready.runtime, next);
    return { ok: true, record: result.record, state: this.snapshot() };
  }

  uninstall(packageId: string, confirmed: boolean) {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const result = ready.runtime.uninstallMarketplacePackage({ packageId, existingRecords: ready.state.records, confirmed });
    if (!result.ok) return { ok: false, error: result.detail };
    const next = { ...ready.state, records: result.records, audit: [...ready.state.audit, result.audit] };
    this.persist(ready.runtime, next);
    return { ok: true, state: this.snapshot() };
  }

  reviewPublisher(raw: unknown) {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const checked = ready.runtime.trustCommunityPublisher({ raw, existingEntries: this.trustStore, confirmed: true });
    if (!checked.ok) return { ok: false, error: checked.detail };
    return { ok: true, rawPublisher: raw, entry: checked.entry, fingerprintSha256: checked.fingerprintSha256 };
  }

  trustPublisher(raw: unknown, confirmed: boolean) {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const result = ready.runtime.trustCommunityPublisher({ raw, existingEntries: this.trustStore, confirmed });
    if (!result.ok) return { ok: false, error: result.detail };
    const bundledIds = new Set(BUNDLED_MARKETPLACE_TRUST.map((entry) => entry.keyId));
    const next = { ...ready.state, communityTrustEntries: result.entries.filter((entry) => entry.trustTier === 'community' && !bundledIds.has(entry.keyId)) };
    this.persist(ready.runtime, next);
    this.trustStore = result.entries;
    return { ok: true, state: this.snapshot() };
  }

  revokePublisher(keyId: string, confirmed: boolean) {
    const ready = this.ready();
    if (!ready.ok) return ready;
    const result = ready.runtime.revokeCommunityPublisher({ keyId, existingEntries: this.trustStore, confirmed });
    if (!result.ok) return { ok: false, error: result.detail };
    const next = { ...ready.state, communityTrustEntries: result.entries.filter((entry) => entry.trustTier === 'community') };
    this.persist(ready.runtime, next);
    this.trustStore = result.entries;
    return { ok: true, state: this.snapshot() };
  }

  reset(confirmed: boolean) {
    this.initialize();
    if (confirmed !== true) return { ok: false, error: 'explicit marketplace state reset confirmation is required' };
    const runtime = loadRuntime();
    if ('error' in runtime) return { ok: false, error: runtime.error };
    const filePath = this.statePath();
    if (fs.existsSync(filePath)) fs.renameSync(filePath, `${filePath}.discarded-${timestampSuffix()}`);
    const next = runtime.createEmptyMarketplaceState();
    this.persist(runtime, next);
    this.blockedError = null;
    this.quarantinedPath = null;
    this.trustStore = [...BUNDLED_MARKETPLACE_TRUST];
    return { ok: true, state: this.snapshot() };
  }
}

export function registerMarketplaceIpc() {
  const store = new MarketplaceDesktopStore();
  ipcMain.handle('marketplace:state', () => store.snapshot());
  ipcMain.handle('marketplace:runtimeAssets', () => store.runtimeAssets());
  ipcMain.handle('marketplace:browsePackage', async () => {
    const result = await dialog.showOpenDialog({ title: 'Review signed RealityWarden package', properties: ['openFile'], filters: [{ name: 'Signed marketplace package', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try { return { canceled: false, ...store.reviewPackage(readJsonFile(result.filePaths[0])) }; }
    catch (error) { return { canceled: false, ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('marketplace:install', (_event, payload: { rawPackage?: unknown; confirmed?: unknown }) => store.install(payload?.rawPackage, payload?.confirmed === true));
  ipcMain.handle('marketplace:enableSimulation', (_event, payload: { packageId?: unknown; confirmed?: unknown }) => store.enable(typeof payload?.packageId === 'string' ? payload.packageId : '', payload?.confirmed === true));
  ipcMain.handle('marketplace:uninstall', (_event, payload: { packageId?: unknown; confirmed?: unknown }) => store.uninstall(typeof payload?.packageId === 'string' ? payload.packageId : '', payload?.confirmed === true));
  ipcMain.handle('marketplace:browsePublisher', async () => {
    const result = await dialog.showOpenDialog({ title: 'Review community publisher key', properties: ['openFile'], filters: [{ name: 'Community publisher key', extensions: ['json'] }] });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try { return { canceled: false, ...store.reviewPublisher(readJsonFile(result.filePaths[0])) }; }
    catch (error) { return { canceled: false, ok: false, error: error instanceof Error ? error.message : String(error) }; }
  });
  ipcMain.handle('marketplace:trustPublisher', (_event, payload: { rawPublisher?: unknown; confirmed?: unknown }) => store.trustPublisher(payload?.rawPublisher, payload?.confirmed === true));
  ipcMain.handle('marketplace:revokePublisher', (_event, payload: { keyId?: unknown; confirmed?: unknown }) => store.revokePublisher(typeof payload?.keyId === 'string' ? payload.keyId : '', payload?.confirmed === true));
  ipcMain.handle('marketplace:resetState', (_event, payload: { confirmed?: unknown }) => store.reset(payload?.confirmed === true));
}
