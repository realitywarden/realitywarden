const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const compiledRoot = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.resolve(__dirname, '..', '..');

function requireFromCompiled(relativePath) {
  return require(path.join(compiledRoot, relativePath));
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(path.resolve(__dirname, '..', '..'), relativePath));
}

assert(fileExists('docs/DEVICE_ONBOARDING.md'), 'docs/DEVICE_ONBOARDING.md must exist.');
assert(fileExists('examples/device-manifest-template.ts'), 'examples/device-manifest-template.ts must exist.');

const { simpleSensorDeviceManifest, simpleSensorWorldModel, simpleSensorOnboardingChecklist } = requireFromCompiled('examples/device-manifest-template.js');
const { compileOpenRealityRuntime } = requireFromCompiled('lib/open-reality-runtime/runtimeKernel.js');
const { createFirmwareConfigurationDraft, validateFirmwareConfigurationDraft } = requireFromCompiled('lib/device-onboarding/FirmwareConfiguration.js');

assert.equal(simpleSensorDeviceManifest.deviceId, 'simple_sensor_01', 'Example manifest should export the fictional simple sensor.');
assert.equal(simpleSensorDeviceManifest.adapter.realAdapterEnabled, false, 'Onboarding example must keep realAdapterEnabled false.');
assert.ok(['simulation_only', 'coming_soon'].includes(simpleSensorDeviceManifest.supportLevel), 'Onboarding example must stay simulation_only or coming_soon.');

const supported = compileOpenRealityRuntime({
  userPrompt: 'read sensor state',
  targetDeviceId: simpleSensorDeviceManifest.deviceId,
  manifest: simpleSensorDeviceManifest,
  worldModel: simpleSensorWorldModel,
  locale: 'en'
});

assert.equal(supported.status, 'compiled', 'Supported low-risk prompt should compile for the onboarding example.');

const unsupported = compileOpenRealityRuntime({
  userPrompt: 'turn on the light',
  targetDeviceId: simpleSensorDeviceManifest.deviceId,
  manifest: simpleSensorDeviceManifest,
  worldModel: simpleSensorWorldModel,
  locale: 'en'
});

assert.equal(unsupported.status, 'unsupported', 'Unsupported capability must not execute for the onboarding example.');
assert.equal(unsupported.taskDsl, undefined, 'Unsupported capability must not produce TaskDSL execution output.');

assert.equal(simpleSensorOnboardingChecklist.simulationAdapter.dryRunOnly, true, 'Onboarding example must keep simulation adapter dry-run only.');

const sourceSha = 'a'.repeat(64);
const reviewedRig = createFirmwareConfigurationDraft({
  source_sha256: sourceSha, reviewed_profile_id: 'manual-reviewed-rig', device_type: 'robot_arm', board: 'esp32_s3', human_review_confirmed: true,
  components: [
    { kind: 'sg90_servo', pwm_pin: 18, min_angle: 0, max_angle: 180 },
    { kind: 'hc_sr04', trigger_pin: 5, echo_pin: 4, min_safe_distance_cm: 20 }
  ]
}, '2026-07-15T00:00:00.000Z');
assert.equal(reviewedRig.ok, true, 'Reviewed SG90 + HC-SR04 configuration should produce a draft.');
assert.equal(reviewedRig.draft.write_authorized, false, 'A firmware draft must never authorize writing.');
assert.equal(reviewedRig.draft.real_adapter_enabled, false, 'A firmware draft must never enable a real adapter.');
assert.equal(reviewedRig.draft.simulation_only, true, 'A firmware draft must remain simulation-only.');
assert.equal(createFirmwareConfigurationDraft({ source_sha256: sourceSha, reviewed_profile_id: 'x', device_type: 'smart_light', board: 'esp32_s3', human_review_confirmed: false, components: [{ kind: 'digital_output', output_pin: 8, active_high: true, safe_default: false }] }).ok, false, 'Firmware configuration requires explicit review.');
assert.equal(createFirmwareConfigurationDraft({ source_sha256: sourceSha, reviewed_profile_id: 'x', device_type: 'smart_light', board: 'esp32_s3', human_review_confirmed: true, components: [{ kind: 'digital_output', output_pin: 0, active_high: true, safe_default: false }] }).ok, false, 'Reserved or unreviewed GPIO must be rejected.');
assert.equal(createFirmwareConfigurationDraft({ source_sha256: sourceSha, reviewed_profile_id: 'x', device_type: 'smart_light', board: 'esp32_s3', human_review_confirmed: true, components: [{ kind: 'sg90_servo', pwm_pin: 18, min_angle: 0, max_angle: 180 }] }).ok, false, 'Cross-device component sets must be rejected.');
assert.equal(createFirmwareConfigurationDraft({ source_sha256: sourceSha, reviewed_profile_id: 'x', device_type: 'robot_arm', board: 'esp32_s3', human_review_confirmed: true, components: [{ kind: 'sg90_servo', pwm_pin: 5, min_angle: 0, max_angle: 180 }, { kind: 'hc_sr04', trigger_pin: 5, echo_pin: 4, min_safe_distance_cm: 20 }] }).ok, false, 'Duplicate pin assignments must be rejected.');
assert.equal(validateFirmwareConfigurationDraft({ ...reviewedRig.draft, write_authorized: true }).ok, false, 'Stored draft tampering cannot authorize writing.');
assert.equal(validateFirmwareConfigurationDraft({ ...reviewedRig.draft, real_adapter_enabled: true }).ok, false, 'Stored draft tampering cannot enable a real adapter.');

console.log('Device onboarding tests passed.');
console.log('- Fictional simple_sensor manifest loads.');
console.log('- realAdapterEnabled remains false.');
console.log('- Supported read prompt compiles.');
console.log('- Unsupported actuation prompt does not execute.');
console.log('- Reviewed ESP32-S3 firmware drafts stay simulation-only and write-disabled.');
console.log('- Unsafe GPIO, duplicate pins, mismatched components, and authority tampering are rejected.');
