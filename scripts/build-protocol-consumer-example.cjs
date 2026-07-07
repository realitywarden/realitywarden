const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const exampleDir = path.join(root, 'examples', 'protocol');
const catalogPath = path.join(exampleDir, 'openreality-protocol-v0.1.catalog.json');
const runnablePath = path.join(exampleDir, 'openreality-protocol-v0.1.runnable.json');
const supportMatrixPath = path.join(exampleDir, 'openreality-protocol-v0.1.support-matrix.json');
const outputPath = path.join(exampleDir, 'openreality-protocol-v0.1.consumer-example.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function unique(values) {
  return [...new Set(values)];
}

const catalog = readJson(catalogPath);
const runnable = readJson(runnablePath);
const supportMatrix = readJson(supportMatrixPath);

const runnableAssets = runnable.map((asset) => ({
  asset_id: asset.asset_id,
  device_type: asset.device_type,
  display_name: asset.manifest.display_name,
  simulation_allowed: asset.runtime_permissions.some(
    (permission) => permission.permission === 'simulation.run' && permission.allowed
  ),
  real_device_allowed: asset.runtime_permissions.some(
    (permission) => permission.permission === 'real_device.execute' && permission.allowed
  ),
  primary_adapter: asset.adapter_binding.adapter_type,
  supported_commands: asset.adapter_binding.supported_commands,
  normalized_capabilities: asset.normalized_capabilities.map((capability) => capability.normalized)
}));

const nonRunnableAssets = supportMatrix
  .filter((entry) => !entry.public_alpha_runnable)
  .map((entry) => ({
    asset_id: entry.asset_id,
    device_type: entry.device_type,
    display_name: entry.display_name,
    public_alpha_runnable: entry.public_alpha_runnable,
    runtime_execution: entry.runtime_execution,
    note: entry.notes
  }));

const adapterIntakeDecisions = catalog.map((asset) => ({
  asset_id: asset.asset_id,
  device_type: asset.device_type,
  allowed_for_public_alpha_run: asset.manifest.public_alpha_runnable,
  allow_simulation_adapter_binding:
    asset.adapter_binding.adapter_type === 'simulator' &&
    asset.runtime_permissions.some((permission) => permission.permission === 'simulation.run' && permission.allowed),
  allow_real_device_adapter_binding: asset.runtime_permissions.some(
    (permission) => permission.permission === 'real_device.execute' && permission.allowed
  ),
  decision: asset.manifest.public_alpha_runnable
    ? 'accept_simulation_runtime'
    : 'keep_protocol_only_until_runtime_support'
}));

const consumerExample = {
  protocol_version: 'openreality.protocol.v0.1',
  generated_from: {
    catalog: path.relative(root, catalogPath),
    runnable_subset: path.relative(root, runnablePath),
    support_matrix: path.relative(root, supportMatrixPath)
  },
  consumer_summary: {
    total_assets: catalog.length,
    runnable_assets: runnableAssets.length,
    non_runnable_assets: nonRunnableAssets.length,
    adapter_types_seen: unique(catalog.map((asset) => asset.adapter_binding.adapter_type)),
    real_device_execution_assets: catalog.filter((asset) =>
      asset.runtime_permissions.some((permission) => permission.permission === 'real_device.execute' && permission.allowed)
    ).length
  },
  runnable_assets: runnableAssets,
  non_runnable_assets: nonRunnableAssets,
  adapter_intake_decisions: adapterIntakeDecisions,
  public_alpha_boundary: {
    simulation_only: true,
    real_device_execution_enabled: false,
    supported_run_targets: runnableAssets.map((asset) => asset.device_type)
  }
};

fs.writeFileSync(outputPath, `${JSON.stringify(consumerExample, null, 2)}\n`);
console.log(`Built protocol consumer example at ${path.relative(root, outputPath)}`);
