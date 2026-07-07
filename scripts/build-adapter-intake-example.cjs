const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const exampleDir = path.join(root, 'examples', 'protocol');
const consumerExamplePath = path.join(exampleDir, 'openreality-protocol-v0.1.consumer-example.json');
const outputPath = path.join(exampleDir, 'openreality-protocol-v0.1.adapter-intake.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const consumerExample = readJson(consumerExamplePath);

function buildSimulationIntake(runnableAsset) {
  return {
    asset_id: runnableAsset.asset_id,
    device_type: runnableAsset.device_type,
    adapter_id: `${runnableAsset.primary_adapter}:${runnableAsset.asset_id}`,
    accepted: runnableAsset.simulation_allowed === true,
    runtime_mode: 'simulation',
    allow_commands: runnableAsset.supported_commands,
    allow_normalized_capabilities: runnableAsset.normalized_capabilities,
    deny_real_device_execution: true,
    notes: [
      'Accepted only for the simulation-only Public Alpha runtime.',
      'Adapter intake must preserve runtime_permissions and not silently upgrade to real-device execution.'
    ]
  };
}

function buildProtocolOnlyIntake(nonRunnableAsset) {
  return {
    asset_id: nonRunnableAsset.asset_id,
    device_type: nonRunnableAsset.device_type,
    accepted: false,
    runtime_mode: 'protocol_only',
    deny_reason: 'Not runnable in the Public Alpha desktop Run flow.',
    next_step: 'Keep as protocol-shaped asset until runtime support lands.',
    notes: [nonRunnableAsset.note]
  };
}

const simulationIntake = consumerExample.runnable_assets.map(buildSimulationIntake);
const protocolOnlyIntake = consumerExample.non_runnable_assets.map(buildProtocolOnlyIntake);

const adapterIntake = {
  protocol_version: 'openreality.protocol.v0.1',
  source: path.relative(root, consumerExamplePath),
  intake_rules: {
    accept_only_public_alpha_runnable_assets: true,
    require_simulation_allowed_permission: true,
    deny_real_device_execute_when_false: true,
    deny_protocol_only_assets_from_main_run: true
  },
  simulation_runtime_accepts: simulationIntake,
  protocol_only_assets: protocolOnlyIntake,
  summary: {
    accepted_assets: simulationIntake.length,
    protocol_only_assets: protocolOnlyIntake.length,
    real_device_execution_enabled: false
  }
};

fs.writeFileSync(outputPath, `${JSON.stringify(adapterIntake, null, 2)}\n`);
console.log(`Built adapter intake example at ${path.relative(root, outputPath)}`);
