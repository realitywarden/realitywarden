const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const profilesDir = path.join(root, 'profiles');
const scenariosDir = path.join(root, 'scenarios');
const profileIds = [
  'virtual-robot-arm',
  'virtual-mobile-robot',
  'virtual-smart-light',
  'virtual-camera-sensor',
  'virtual-conveyor-belt'
];
const requiredReportFields = [
  'status',
  'created_at',
  'target_device',
  'goal',
  'capabilities',
  'safety_decision',
  'execution_mode',
  'reason',
  'user_facing_message',
  'device_profile',
  'task_dsl',
  'runtime_audit_log',
  'safety_report',
  'adapter_commands',
  'device_state_before',
  'device_state_after',
  'state_snapshots'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasChanged(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function main() {
  const registrySource = fs.readFileSync(path.join(root, 'lib', 'virtual-lab', 'VirtualDeviceRegistry.ts'), 'utf8');
  const adapterInterfaceSource = fs.readFileSync(path.join(root, 'lib', 'adapter', 'AdapterInterface.ts'), 'utf8');
  const simulatorAdapterSource = fs.readFileSync(path.join(root, 'lib', 'virtual-lab', 'SimulatorAdapter.ts'), 'utf8');
  const scenarioFiles = fs.readdirSync(scenariosDir).filter((file) => file.endsWith('.json'));
  const scenarios = scenarioFiles.map((file) => readJson(path.join(scenariosDir, file)));

  for (const method of ['connect', 'disconnect', 'getDeviceMeta', 'executeCommand', 'getState', 'stop', 'emergencyStop']) {
    assert(adapterInterfaceSource.includes(`${method}(`), `AdapterInterface missing ${method}()`);
    assert(simulatorAdapterSource.includes(`${method}(`), `SimulatorAdapter missing ${method}()`);
  }

  for (const profileId of profileIds) {
    const profileDir = path.join(profilesDir, profileId);
    for (const file of ['device.meta.json', 'geometry.json', 'safety.rules.ts', 'simulator.adapter.ts', 'README.md']) {
      assert(fs.existsSync(path.join(profileDir, file)), `${profileId} missing ${file}`);
    }

    const meta = readJson(path.join(profileDir, 'device.meta.json'));
    const geometry = readJson(path.join(profileDir, 'geometry.json'));
    assert(meta.profile_id === profileId, `${profileId} profile_id mismatch`);
    assert(meta.device_type, `${profileId} missing device_type`);
    assert(meta.simulator_fidelity, `${profileId} missing simulator_fidelity`);
    assert(meta.simulator_fidelity.validates.includes('adapter_commands'), `${profileId} simulator_fidelity must validate adapter_commands`);
    assert(meta.simulator_fidelity.validates.includes('state_transition'), `${profileId} simulator_fidelity must validate state_transition`);
    assert(Array.isArray(meta.capabilities) && meta.capabilities.length > 0, `${profileId} missing capabilities`);
    assert(geometry.workspace && geometry.camera, `${profileId} geometry is incomplete`);
    assert(registrySource.includes(profileId), `${profileId} is not registered in VirtualDeviceRegistry`);

    const safeScenario = scenarios.find((scenario) => scenario.device_profile === profileId && scenario.mode === 'safe');
    const unsafeScenario = scenarios.find((scenario) => scenario.device_profile === profileId && scenario.mode === 'unsafe');
    assert(safeScenario, `${profileId} missing safe scenario`);
    assert(unsafeScenario, `${profileId} missing unsafe scenario`);
    assert(safeScenario.expected_safety_result === 'pass', `${profileId} safe scenario must pass`);
    assert(unsafeScenario.expected_safety_result === 'blocked', `${profileId} unsafe scenario must be blocked`);
    assert(hasChanged(safeScenario.initial_state, safeScenario.expected_state_after), `${profileId} safe state must update`);
    assert(!hasChanged(unsafeScenario.initial_state, unsafeScenario.expected_state_after), `${profileId} unsafe state must remain unchanged`);
  }

  const labReportSource = fs.readFileSync(path.join(root, 'lib', 'virtual-lab', 'LabReport.ts'), 'utf8');
  for (const field of requiredReportFields) {
    assert(labReportSource.includes(field), `LabReport missing ${field}`);
  }
  assert(labReportSource.includes('TimelineStateSnapshot'), 'LabReport must define TimelineStateSnapshot for replay');
  assert(labReportSource.includes('changed_keys'), 'TimelineStateSnapshot must include changed_keys for State Inspector diff');

  const runnerSource = fs.readFileSync(path.join(root, 'lib', 'virtual-lab', 'ScenarioRunner.ts'), 'utf8');
  assert(runnerSource.includes('runSafetyRuntime'), 'ScenarioRunner must run Safety Runtime before adapter execution');
  assert(runnerSource.indexOf('runSafetyRuntime') < runnerSource.indexOf('adapter.executeCommand'), 'Safety Runtime must run before adapter commands execute');
  assert(runnerSource.includes("result === 'blocked' ? deviceStateBefore"), 'Blocked runs must preserve device state');

  const hardwareAdapterSource = fs.readFileSync(path.join(root, 'lib', 'hardware', 'Esp32DeviceAdapter.ts'), 'utf8');
  const gateSource = fs.readFileSync(path.join(root, 'lib', 'hardware', 'HardwareExecutionGate.ts'), 'utf8');
  assert(hardwareAdapterSource.includes('ticket: ActuationTicket'), 'Real hardware adapter must require a gate-private ticket');
  assert(gateSource.includes('adapter.execute(command, ACTUATION_TICKET)'), 'HardwareExecutionGate must own the real actuation call');

  for (const scenario of scenarios) {
    if (scenario.mode === 'safe') {
      assert(scenario.expected_safety_result === 'pass', `${scenario.id} safe scenario must expect pass`);
      assert(hasChanged(scenario.initial_state, scenario.expected_state_after), `${scenario.id} safe scenario must define state change`);
    } else {
      assert(scenario.expected_safety_result === 'blocked', `${scenario.id} unsafe scenario must expect blocked`);
      assert(scenario.unsafe_actions.length > 0, `${scenario.id} unsafe scenario must name unsafe actions`);
      assert(!hasChanged(scenario.initial_state, scenario.expected_state_after), `${scenario.id} blocked scenario must preserve state`);
    }
  }

  console.log(`Virtual Lab tests passed: ${profileIds.length} profiles, ${scenarios.length} scenarios, simulator AdapterInterface + ticketed hardware boundary verified.`);
}

main();
