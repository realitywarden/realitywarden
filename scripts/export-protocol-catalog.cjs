const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assetRoot = path.join(root, 'assets', 'devices');
const outputDir = path.join(root, 'examples', 'protocol');
const outputFile = path.join(outputDir, 'openreality-protocol-v0.1.catalog.json');
const runnableOutputFile = path.join(outputDir, 'openreality-protocol-v0.1.runnable.json');
const supportMatrixOutputFile = path.join(outputDir, 'openreality-protocol-v0.1.support-matrix.json');

const PROTOCOL_VERSION = 'openreality.protocol.v0.1';
const PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES = new Set(['robot_arm', 'smart_light', 'camera_sensor']);

const CAPABILITY_NORMALIZER = {
  scan_area: { normalized: 'vision.scan_area', capability_class: 'vision', device_types: ['robot_arm', 'camera_sensor'], requires_target: false, requires_value: false, risk_hint: 'low' },
  identify_object: { normalized: 'manipulation.identify_object', capability_class: 'manipulation', device_types: ['robot_arm'], requires_target: true, requires_value: false, risk_hint: 'low' },
  move_to_pose: { normalized: 'motion.move_to_pose', capability_class: 'motion', device_types: ['robot_arm'], requires_target: true, requires_value: false, risk_hint: 'medium' },
  grasp: { normalized: 'manipulation.grasp', capability_class: 'manipulation', device_types: ['robot_arm'], requires_target: true, requires_value: false, risk_hint: 'medium' },
  release: { normalized: 'manipulation.release', capability_class: 'manipulation', device_types: ['robot_arm'], requires_target: true, requires_value: false, risk_hint: 'medium' },
  return_home: { normalized: 'motion.return_home', capability_class: 'motion', device_types: ['robot_arm'], requires_target: false, requires_value: false, risk_hint: 'low' },
  navigate_to: { normalized: 'motion.navigate_to', capability_class: 'motion', device_types: ['mobile_robot'], requires_target: true, requires_value: false, risk_hint: 'medium' },
  dock: { normalized: 'motion.dock', capability_class: 'motion', device_types: ['mobile_robot'], requires_target: true, requires_value: false, risk_hint: 'low' },
  set_light: { normalized: 'lighting.set_power', capability_class: 'lighting', device_types: ['smart_light'], requires_target: false, requires_value: true, risk_hint: 'low' },
  set_brightness: { normalized: 'lighting.set_brightness', capability_class: 'lighting', device_types: ['smart_light'], requires_target: false, requires_value: true, risk_hint: 'low' },
  set_color: { normalized: 'lighting.set_color', capability_class: 'lighting', device_types: ['smart_light'], requires_target: false, requires_value: true, risk_hint: 'low' },
  capture_frame: { normalized: 'vision.capture_frame', capability_class: 'vision', device_types: ['camera_sensor'], requires_target: false, requires_value: false, risk_hint: 'low' },
  read_sensor: { normalized: 'sensor.read_sensor', capability_class: 'sensor', device_types: ['camera_sensor', 'sensor_box'], requires_target: false, requires_value: false, risk_hint: 'low' },
  read_register: { normalized: 'automation.read_register', capability_class: 'automation', device_types: ['plc_cabinet'], requires_target: true, requires_value: false, risk_hint: 'low' },
  write_register: { normalized: 'automation.write_register', capability_class: 'automation', device_types: ['plc_cabinet'], requires_target: true, requires_value: true, risk_hint: 'medium' },
  start_sequence: { normalized: 'automation.start_sequence', capability_class: 'automation', device_types: ['plc_cabinet'], requires_target: false, requires_value: false, risk_hint: 'medium' },
  stop_sequence: { normalized: 'automation.stop_sequence', capability_class: 'automation', device_types: ['plc_cabinet'], requires_target: false, requires_value: false, risk_hint: 'low' },
  read_measurement: { normalized: 'lab.read_measurement', capability_class: 'lab', device_types: ['lab_instrument'], requires_target: false, requires_value: false, risk_hint: 'low' },
  set_parameter: { normalized: 'lab.set_parameter', capability_class: 'lab', device_types: ['lab_instrument'], requires_target: true, requires_value: true, risk_hint: 'medium' },
  start_test: { normalized: 'lab.start_test', capability_class: 'lab', device_types: ['lab_instrument'], requires_target: false, requires_value: false, risk_hint: 'medium' },
  stop_test: { normalized: 'lab.stop_test', capability_class: 'lab', device_types: ['lab_instrument'], requires_target: false, requires_value: false, risk_hint: 'low' },
  scan_slot: { normalized: 'warehouse.scan_slot', capability_class: 'warehouse', device_types: ['warehouse_rack'], requires_target: true, requires_value: false, risk_hint: 'low' },
  reserve_slot: { normalized: 'warehouse.reserve_slot', capability_class: 'warehouse', device_types: ['warehouse_rack'], requires_target: true, requires_value: false, risk_hint: 'low' },
  release_slot: { normalized: 'warehouse.release_slot', capability_class: 'warehouse', device_types: ['warehouse_rack'], requires_target: true, requires_value: false, risk_hint: 'low' },
  mark_item: { normalized: 'warehouse.mark_item', capability_class: 'warehouse', device_types: ['warehouse_rack'], requires_target: true, requires_value: true, risk_hint: 'low' },
  calibrate_sensor: { normalized: 'sensor.calibrate_sensor', capability_class: 'sensor', device_types: ['sensor_box'], requires_target: false, requires_value: false, risk_hint: 'medium' },
  reset_sensor: { normalized: 'sensor.reset_sensor', capability_class: 'sensor', device_types: ['sensor_box'], requires_target: false, requires_value: false, risk_hint: 'low' },
  start_belt: { normalized: 'motion.start_belt', capability_class: 'motion', device_types: ['conveyor_belt'], requires_target: false, requires_value: false, risk_hint: 'medium' },
  stop_belt: { normalized: 'motion.stop_belt', capability_class: 'motion', device_types: ['conveyor_belt'], requires_target: false, requires_value: false, risk_hint: 'low' },
  sort_item: { normalized: 'motion.sort_item', capability_class: 'motion', device_types: ['conveyor_belt'], requires_target: true, requires_value: false, risk_hint: 'medium' }
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeCapabilities(capabilities) {
  return capabilities.map((capability) => ({
    raw: capability,
    ...CAPABILITY_NORMALIZER[capability]
  }));
}

function buildComponentGraph(deviceType, geometry) {
  const nodes = [
    {
      id: 'device',
      type: 'device',
      label: deviceType,
      position: geometry.robot?.base_position ?? geometry.camera?.position
    },
    {
      id: 'workspace',
      type: 'workspace',
      label: 'workspace',
      metadata: geometry.workspace
    }
  ];

  const edges = [{ from: 'workspace', to: 'device', relation: 'contains' }];

  for (const [zoneId, zone] of Object.entries(geometry.zones ?? {})) {
    nodes.push({
      id: zoneId,
      type: 'zone',
      label: zoneId,
      position: zone.position,
      metadata: { size: zone.size }
    });
    edges.push({ from: 'workspace', to: zoneId, relation: 'contains' });
    edges.push({ from: 'device', to: zoneId, relation: 'targets' });
  }

  for (const [objectId, objectValue] of Object.entries(geometry.objects ?? {})) {
    nodes.push({
      id: objectId,
      type: 'object',
      label: objectId,
      position: objectValue.position,
      metadata: objectValue
    });
    edges.push({ from: 'workspace', to: objectId, relation: 'contains' });
    edges.push({ from: 'device', to: objectId, relation: 'targets' });
  }

  for (const [nodeId, node] of Object.entries(geometry.stage?.nodes ?? {})) {
    nodes.push({
      id: `stage:${nodeId}`,
      type: 'sensor',
      label: node.label ?? nodeId,
      position: node.position
    });
    edges.push({ from: 'workspace', to: `stage:${nodeId}`, relation: 'contains' });
  }

  for (const [indicatorId, indicatorValue] of Object.entries(geometry.stage?.indicators ?? {})) {
    nodes.push({
      id: `indicator:${indicatorId}`,
      type: 'indicator',
      label: indicatorId,
      metadata: { value: indicatorValue }
    });
    edges.push({ from: 'device', to: `indicator:${indicatorId}`, relation: 'monitors' });
  }

  return {
    graph_version: 'component-graph.v1',
    device_type: deviceType,
    nodes,
    edges
  };
}

function buildRuntimePermissions(deviceType, publicAlphaRunnable) {
  return [
    { permission: 'simulation.run', allowed: publicAlphaRunnable, scope: deviceType },
    { permission: 'audit.export', allowed: true, scope: deviceType },
    { permission: 'real_device.connect', allowed: false, scope: deviceType },
    { permission: 'real_device.execute', allowed: false, scope: deviceType }
  ];
}

function buildSafetyProfile(deviceMeta) {
  return {
    profile_version: 'safety-profile.v1',
    risk_class: deviceMeta.risk_class,
    forbidden_zones: deviceMeta.constraints?.forbidden_zones ?? [],
    workspace: deviceMeta.constraints?.workspace ?? null,
    max_speed: deviceMeta.constraints?.max_speed ?? null,
    force_limit: deviceMeta.constraints?.force_limit ?? null,
    policies: deviceMeta.safety_profile ?? {}
  };
}

function buildAdapterBinding(adapterManifest) {
  return {
    binding_version: 'adapter-binding.v1',
    adapter_id: adapterManifest.adapter_id,
    adapter_type: adapterManifest.adapter_type,
    interface: adapterManifest.interface,
    transport: adapterManifest.transport,
    supported_commands: adapterManifest.supported_commands,
    real_device_enabled: adapterManifest.real_device_enabled
  };
}

function buildRealityAsset(assetDir) {
  const manifest = readJson(path.join(assetDir, 'asset.manifest.json'));
  const deviceMeta = readJson(path.join(assetDir, 'device.meta.json'));
  const geometry = readJson(path.join(assetDir, 'geometry.json'));
  const adapterManifest = readJson(path.join(assetDir, 'adapter.manifest.json'));
  const publicAlphaRunnable = PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES.has(deviceMeta.device_type);

  return {
    protocol_version: PROTOCOL_VERSION,
    asset_id: manifest.asset_id,
    device_type: deviceMeta.device_type,
    manifest: {
      protocol_version: PROTOCOL_VERSION,
      manifest_version: 'device-manifest.v1',
      asset_id: manifest.asset_id,
      profile_id: deviceMeta.profile_id,
      device_id: deviceMeta.device_id,
      device_type: deviceMeta.device_type,
      display_name: deviceMeta.display_name,
      manufacturer: deviceMeta.manufacturer,
      model: deviceMeta.model,
      category: manifest.category,
      simulator_fidelity: deviceMeta.simulator_fidelity?.level ?? manifest.simulator_fidelity ?? 'semantic',
      risk_class: deviceMeta.risk_class,
      supported_adapters: deviceMeta.supported_adapters,
      public_alpha_runnable: publicAlphaRunnable
    },
    component_graph: buildComponentGraph(deviceMeta.device_type, geometry),
    normalized_capabilities: normalizeCapabilities(deviceMeta.capabilities),
    safety_profile: buildSafetyProfile(deviceMeta),
    runtime_permissions: buildRuntimePermissions(deviceMeta.device_type, publicAlphaRunnable),
    adapter_binding: buildAdapterBinding(adapterManifest),
    source_asset: {
      license: manifest.license,
      brand: manifest.brand,
      source: manifest.source,
      allowed_use: manifest.allowed_use
    }
  };
}

function buildCatalog() {
  return fs
    .readdirSync(assetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => buildRealityAsset(path.join(assetRoot, entry.name)))
    .sort((left, right) => left.asset_id.localeCompare(right.asset_id));
}

function buildRunnableCatalog(catalog) {
  return catalog.filter((asset) => asset.manifest.public_alpha_runnable);
}

function buildSupportMatrix(catalog) {
  return catalog.map((asset) => ({
    asset_id: asset.asset_id,
    display_name: asset.manifest.display_name,
    device_type: asset.device_type,
    public_alpha_runnable: asset.manifest.public_alpha_runnable,
    runtime_execution: asset.runtime_permissions.some(
      (permission) => permission.permission === 'simulation.run' && permission.allowed
    ),
    real_device_execution: asset.runtime_permissions.some(
      (permission) => permission.permission === 'real_device.execute' && permission.allowed
    ),
    supported_adapters: asset.manifest.supported_adapters,
    normalized_capabilities: asset.normalized_capabilities.map((capability) => capability.normalized),
    notes: asset.manifest.public_alpha_runnable
      ? 'Runnable in the simulation-only Public Alpha desktop flow.'
      : 'Protocol-shaped asset only. Not runnable in the Public Alpha desktop Run flow.'
  }));
}

const catalog = buildCatalog();
const runnableCatalog = buildRunnableCatalog(catalog);
const supportMatrix = buildSupportMatrix(catalog);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(catalog, null, 2)}\n`);
fs.writeFileSync(runnableOutputFile, `${JSON.stringify(runnableCatalog, null, 2)}\n`);
fs.writeFileSync(supportMatrixOutputFile, `${JSON.stringify(supportMatrix, null, 2)}\n`);
console.log(`Exported Open Reality Protocol catalog to ${path.relative(root, outputFile)}`);
console.log(`Exported runnable protocol subset to ${path.relative(root, runnableOutputFile)}`);
console.log(`Exported protocol support matrix to ${path.relative(root, supportMatrixOutputFile)}`);
