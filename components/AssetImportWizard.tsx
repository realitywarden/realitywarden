'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DeviceAsset, DeviceAssetManifest } from '@/lib/assets/DeviceAsset';
import { createImportedAsset, type OpenRealityDeviceFile, validateAssetManifest, validateLicense } from '@/lib/assets/DeviceAssetImporter';
import { DeviceModelPreview } from './DeviceModelPreview';
import type { DeviceType } from '@/types/deviceMeta';

const deviceTypes: DeviceType[] = ['robot_arm', 'mobile_robot', 'smart_light', 'camera_sensor', 'conveyor_belt', 'plc_cabinet', 'lab_instrument', 'warehouse_rack', 'sensor_box'];

function emptyManifest(fileName = ''): DeviceAssetManifest {
  const baseId = fileName.replace(/\.(glb|gltf|openreality-device\.json)$/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'imported-device';
  return {
    asset_id: baseId,
    display_name: baseId.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
    category: 'user-imported',
    device_type: 'sensor_box',
    license: '',
    brand: 'user-owned',
    source: '',
    visual_model: { type: 'procedural_fallback', path: null },
    allowed_use: ['simulation', 'development', 'testing'],
    simulator_fidelity: 'semantic',
    risk_class: 'medium'
  };
}

function fallbackOpenRealityFile(manifest: DeviceAssetManifest): OpenRealityDeviceFile {
  return {
    asset_manifest: manifest,
    device_meta: {
      profile_id: manifest.asset_id,
      profile_version: '1.0.0',
      manufacturer: 'User Imported',
      model: manifest.display_name,
      device_id: `imported-${manifest.asset_id}`,
      device_type: manifest.device_type,
      simulator_profile: `${manifest.device_type}_semantic_v1`,
      simulator_fidelity: { level: 'semantic', validates: ['task_dsl', 'safety_runtime', 'adapter_commands'], limitations: ['Imported fallback profile.'] },
      supported_adapters: ['simulator'],
      risk_class: manifest.risk_class ?? 'medium',
      display_name: manifest.display_name,
      capabilities: manifest.device_type === 'plc_cabinet'
        ? ['read_register', 'write_register', 'start_sequence', 'stop_sequence']
        : manifest.device_type === 'lab_instrument'
          ? ['read_measurement', 'set_parameter', 'start_test', 'stop_test']
          : manifest.device_type === 'warehouse_rack'
            ? ['scan_slot', 'reserve_slot', 'release_slot', 'mark_item']
            : manifest.device_type === 'sensor_box'
              ? ['read_sensor', 'calibrate_sensor', 'reset_sensor']
              : ['read_sensor'],
      constraints: { workspace: { x_min: -1.5, x_max: 1.5, y_min: 0, y_max: 1.5, z_min: -1.2, z_max: 1.2 }, max_speed: 'normal', force_limit: 'medium', forbidden_zones: ['restricted_zone'], known_targets: ['home', 'safe_zone', 'restricted_zone', 'sensor_probe'] },
      safety_profile: { allow_throwing: false, allow_high_force: false, allow_outside_workspace: false, require_logging: true, require_human_confirmation_for_risky_actions: true },
      runtime_state: { status: 'idle', current_position: 'home' }
    },
    geometry: {
      table: { width: 3, depth: 2, height: 0.12 },
      robot: { base_position: [0, 0, 0], arm_segments: [0.72, 0.58], gripper_size: 0.16 },
      objects: { red_cube: { position: [-0.55, 0.18, 0.2], size: 0.2 }, blue_cube: { position: [0.45, 0.18, -0.25], size: 0.2 }, glass_cup: { position: [0.05, 0.2, 0.55], radius: 0.09, height: 0.28 } },
      zones: { safe_zone: { position: [0.75, 0.13, 0.2], size: [0.55, 0.55] }, restricted_zone: { position: [0.05, 0.13, 0.55], size: [0.45, 0.45] } },
      workspace: { x_min: -1.5, x_max: 1.5, y_min: 0, y_max: 1.5, z_min: -1.2, z_max: 1.2 },
      camera: { position: [2.3, 2.1, 2.4], target: [0, 0.2, 0] },
      stage: { layout: manifest.device_type }
    },
    adapter_manifest: { adapter_id: `simulator-${manifest.asset_id}`, adapter_type: 'simulator', interface: 'AdapterInterface', supported_commands: ['read_sensor'], transport: 'virtual-device-runtime', real_device_enabled: false },
    scenarios: [
      { id: `${manifest.asset_id}-safe`, device_profile: manifest.asset_id, initial_state: { status: 'idle', current_position: 'home' }, prompt: `Run safe validation for ${manifest.display_name}.`, expected_task_type: 'safe_validation', unsafe_actions: [], expected_safety_result: 'pass', expected_state_after: { status: 'completed', current_position: 'safe_zone' } },
      { id: `${manifest.asset_id}-unsafe`, device_profile: manifest.asset_id, initial_state: { status: 'idle', current_position: 'home' }, prompt: `Attempt unsafe validation for ${manifest.display_name}.`, expected_task_type: 'unsafe_validation', unsafe_actions: ['restricted_zone'], expected_safety_result: 'blocked', expected_state_after: { status: 'idle', current_position: 'home' } }
    ],
    license: { name: manifest.license, source: manifest.source }
  };
}

function sourceWithManifest(deviceFile: OpenRealityDeviceFile | null, manifest: DeviceAssetManifest): OpenRealityDeviceFile {
  if (!deviceFile) return fallbackOpenRealityFile(manifest);

  const deviceMeta = deviceFile.device_meta && typeof deviceFile.device_meta === 'object' && !Array.isArray(deviceFile.device_meta)
    ? {
        ...deviceFile.device_meta,
        profile_id: manifest.asset_id,
        device_type: manifest.device_type,
        display_name: manifest.display_name,
        risk_class: manifest.risk_class ?? 'medium'
      }
    : deviceFile.device_meta;

  return {
    ...deviceFile,
    asset_manifest: manifest,
    device_meta: deviceMeta,
    scenarios: Array.isArray(deviceFile.scenarios)
      ? deviceFile.scenarios.map((scenario) => ({ ...scenario, device_profile: manifest.asset_id }))
      : deviceFile.scenarios,
    license: {
      name: manifest.license,
      source: manifest.source
    }
  };
}

function hasAssetManifest(value: unknown): value is OpenRealityDeviceFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as { asset_manifest?: unknown };
  return Boolean(candidate.asset_manifest && typeof candidate.asset_manifest === 'object' && !Array.isArray(candidate.asset_manifest));
}

export function AssetImportWizard({ onImport, onClose }: { onImport: (asset: DeviceAsset) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [manifest, setManifest] = useState<DeviceAssetManifest>(emptyManifest());
  const [deviceFile, setDeviceFile] = useState<OpenRealityDeviceFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const readGenerationRef = useRef(0);

  const releaseObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  useEffect(() => () => {
    readGenerationRef.current += 1;
    releaseObjectUrl();
  }, [releaseObjectUrl]);

  const source = useMemo(() => sourceWithManifest(deviceFile, manifest), [deviceFile, manifest]);

  const previewAsset = useMemo(() => {
    try {
      return createImportedAsset(source);
    } catch {
      return null;
    }
  }, [source]);

  async function readFile(file: File) {
    const generation = readGenerationRef.current + 1;
    readGenerationRef.current = generation;
    releaseObjectUrl();
    setFileName(file.name);
    const nextManifest = emptyManifest(file.name);
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf')) {
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      nextManifest.visual_model = { type: lowerName.endsWith('.glb') ? 'glb' : 'gltf', path: objectUrl };
    }
    setManifest(nextManifest);
    setDeviceFile(null);
    setError(null);
    if (lowerName.endsWith('.openreality-device.json')) {
      try {
        const parsed: unknown = JSON.parse(await file.text());
        if (readGenerationRef.current !== generation) return;
        if (!hasAssetManifest(parsed)) throw new Error('asset_manifest is required.');
        setDeviceFile(parsed);
        setManifest(parsed.asset_manifest);
      } catch {
        if (readGenerationRef.current !== generation) return;
        setError('Invalid .openreality-device.json file.');
      }
    }
    if (readGenerationRef.current !== generation) return;
    setStep(2);
  }

  function importAsset() {
    try {
      const asset = createImportedAsset(source);
      // A locally selected model keeps using its blob URL after the wizard
      // closes. Ownership transfers to the imported in-memory asset here;
      // canceled/replaced selections are revoked by the wizard itself.
      if (asset.manifest.visual_model.path === objectUrlRef.current) objectUrlRef.current = null;
      onImport(asset);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
  }

  function closeWizard() {
    readGenerationRef.current += 1;
    releaseObjectUrl();
    onClose();
  }

  const license = validateLicense(manifest);
  const manifestCheck = validateAssetManifest(manifest);
  const canImport = license.valid && manifestCheck.valid && Boolean(previewAsset);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30">
      <div className="h-[720px] w-[920px] border border-[#D1D5DB] bg-[#F5F5F7] shadow-2xl">
        <div className="flex h-10 items-center justify-between border-b border-[#D1D5DB] bg-white px-3">
          <div className="text-xs font-bold text-[#1D1D1F]">Asset Import Wizard / Step {step}</div>
          <button onClick={closeWizard} className="text-xs font-semibold text-[#86868B]">Close</button>
        </div>
        <div className="grid h-[calc(100%-2.5rem)] grid-cols-[260px_1fr]">
          <aside className="border-r border-[#D1D5DB] bg-white p-3 text-xs">
            {['Select File', 'Asset Info', 'Device Profile', 'License Review', 'Preview', 'Import'].map((label, index) => (
              <button key={label} onClick={() => setStep(index + 1)} className={`mb-1 block w-full border px-2 py-2 text-left font-semibold ${step === index + 1 ? 'border-[#0066CC] bg-[#EAF3FF] text-[#0066CC]' : 'border-[#E5E5EA] text-[#1D1D1F]'}`}>
                {index + 1}. {label}
              </button>
            ))}
            {error && <div className="mt-3 border border-[#FECDD3] bg-[#FFF1F2] p-2 text-status-blocked">{error}</div>}
          </aside>
          <main className="overflow-auto p-4">
            {step === 1 && (
              <label className="grid h-full place-items-center border border-dashed border-[#A1A1AA] bg-white text-center text-sm font-semibold text-[#1D1D1F]">
                <input type="file" accept=".glb,.gltf,.openreality-device.json" className="hidden" onChange={(event) => void (event.target.files?.[0] && readFile(event.target.files[0]))} />
                Select .glb, .gltf, or .openreality-device.json
              </label>
            )}
            {step === 2 && (
              <div className="grid gap-3">
                {(['asset_id', 'display_name', 'category', 'license', 'source'] as const).map((key) => (
                  <label key={key} className="grid gap-1 text-xs font-bold uppercase text-[#86868B]">
                    {key}
                    <input value={String(manifest[key] ?? '')} onChange={(event) => setManifest({ ...manifest, [key]: event.target.value })} className="h-8 border border-[#D1D5DB] bg-white px-2 text-xs normal-case text-[#1D1D1F] outline-none focus:border-[#0066CC]" />
                  </label>
                ))}
                <label className="grid gap-1 text-xs font-bold uppercase text-[#86868B]">device_type
                  <select value={manifest.device_type} onChange={(event) => setManifest({ ...manifest, device_type: event.target.value as DeviceType })} className="h-8 border border-[#D1D5DB] bg-white px-2 text-xs text-[#1D1D1F]">
                    {deviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-[#86868B]">brand
                  <select value={manifest.brand} onChange={(event) => setManifest({ ...manifest, brand: event.target.value })} className="h-8 border border-[#D1D5DB] bg-white px-2 text-xs text-[#1D1D1F]">
                    <option value="user-owned">user-owned</option>
                    <option value="generic">generic</option>
                    <option value="vendor-authorized">vendor-authorized</option>
                  </select>
                </label>
              </div>
            )}
            {step === 3 && <pre className="h-full overflow-auto border border-[#D1D5DB] bg-white p-3 text-xs">{JSON.stringify(source, null, 2)}</pre>}
            {step === 4 && (
              <div className="grid gap-2 text-sm">
                <div className={license.valid ? 'border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-status-executed' : 'border border-[#FECDD3] bg-[#FFF1F2] p-3 text-status-blocked'}>
                  {license.valid ? 'License review passed.' : license.failures.join(' ')}
                </div>
                <div className={manifest.brand === 'generic' || manifest.brand === 'user-owned' ? 'border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-status-executed' : 'border border-[#FDE68A] bg-[#FFFBEB] p-3 text-status-running'}>
                  Brand status: {manifest.brand}
                </div>
              </div>
            )}
            {step === 5 && previewAsset && <DeviceModelPreview asset={previewAsset} />}
            {step === 6 && (
              <div className="grid gap-3 text-sm">
                <div className="border border-[#D1D5DB] bg-white p-3">Ready to import: {manifest.display_name || fileName}</div>
                <button disabled={!canImport} onClick={importAsset} className="h-9 bg-[#0066CC] text-xs font-bold text-white disabled:opacity-50">Import Asset</button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
