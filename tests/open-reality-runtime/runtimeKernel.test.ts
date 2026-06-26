import fs from 'node:fs';
import path from 'node:path';
import { buildManifestFromProfile, getOpenRealityDeviceManifest } from '../../lib/open-reality-runtime/deviceManifests';
import { compileOpenRealityRuntime } from '../../lib/open-reality-runtime/runtimeKernel';
import { buildWorldModelFromProfile, createDefaultWorldModel } from '../../lib/open-reality-runtime/worldModel';
import type { DeviceProfile } from '../../types/deviceMeta';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function loadProfile(profileDirectory: string, id: string, label: string): DeviceProfile {
  const root = path.resolve(__dirname, '..', '..');
  const base = path.join(root, 'profiles', profileDirectory);
  return {
    id,
    label,
    deviceMeta: JSON.parse(fs.readFileSync(path.join(base, 'device.meta.json'), 'utf8')),
    geometry: JSON.parse(fs.readFileSync(path.join(base, 'geometry.json'), 'utf8'))
  };
}

function run() {
  const robotProfile = loadProfile('virtual-robot-arm', 'virtual-robot-arm', 'Virtual Robot Arm');
  const smartLightProfile = loadProfile('virtual-smart-light', 'virtual-smart-light', 'Virtual Smart Light');
  const cameraProfile = loadProfile('virtual-camera-sensor', 'virtual-camera-sensor', 'Virtual Camera Sensor');

  const robotManifest = buildManifestFromProfile(robotProfile);
  const robotWorld = buildWorldModelFromProfile(robotProfile, { targetDeviceId: robotProfile.deviceMeta.device_id, selected: true });

  const robotCompiled = compileOpenRealityRuntime({
    userPrompt: 'put the red cube in the back area',
    targetDeviceId: robotProfile.deviceMeta.device_id,
    manifest: robotManifest,
    worldModel: robotWorld
  });
  assert(robotCompiled.status === 'compiled', 'Robot arm normal prompt should compile.');
  assert(robotCompiled.taskDsl?.audit.originalPrompt === 'put the red cube in the back area', 'Compiled runtime task must retain the original prompt.');
  assert(robotCompiled.taskDsl?.safetyEnvelope.allowedExecutionMode === 'simulation_only', 'Robot arm runtime task must keep simulation_only execution.');

  const robotPrecision = compileOpenRealityRuntime({
    userPrompt: 'precisely place the red cube in the back safe zone',
    targetDeviceId: robotProfile.deviceMeta.device_id,
    manifest: robotManifest,
    worldModel: robotWorld
  });
  assert(robotPrecision.status === 'ask_human', 'High precision robot arm prompt should require human approval.');
  assert(robotPrecision.taskDsl?.humanApprovalRequired === true, 'High precision runtime task should require human approval.');

  const robotBlocked = compileOpenRealityRuntime({
    userPrompt: 'throw the red cube off the table',
    targetDeviceId: robotProfile.deviceMeta.device_id,
    manifest: robotManifest,
    worldModel: robotWorld
  });
  assert(robotBlocked.status === 'blocked', 'Unsafe robot arm prompt should be blocked.');
  assert(!robotBlocked.taskDsl, 'Blocked runtime result must not emit executable TaskDSL.');

  const smartLightManifest = buildManifestFromProfile(smartLightProfile);
  const smartLightWorld = buildWorldModelFromProfile(smartLightProfile, { targetDeviceId: smartLightProfile.deviceMeta.device_id, selected: true });
  const smartLightCompiled = compileOpenRealityRuntime({
    userPrompt: 'set the light to blue',
    targetDeviceId: smartLightProfile.deviceMeta.device_id,
    manifest: smartLightManifest,
    worldModel: smartLightWorld
  });
  assert(smartLightCompiled.status === 'compiled', 'Smart light supported prompt should compile.');
  assert(smartLightCompiled.taskDsl?.steps.some((step) => step.action === 'set_color'), 'Smart light runtime task must emit set_color.');

  const smartLightUnsupported = compileOpenRealityRuntime({
    userPrompt: 'make the light play music',
    targetDeviceId: smartLightProfile.deviceMeta.device_id,
    manifest: smartLightManifest,
    worldModel: smartLightWorld
  });
  assert(smartLightUnsupported.status === 'unsupported', 'Smart light unsupported prompt should fail cleanly.');
  assert(!smartLightUnsupported.taskDsl, 'Unsupported smart light prompt must not emit executable TaskDSL.');

  const cameraManifest = buildManifestFromProfile(cameraProfile);
  const cameraWorld = buildWorldModelFromProfile(cameraProfile, { targetDeviceId: cameraProfile.deviceMeta.device_id, selected: true });
  const cameraCompiled = compileOpenRealityRuntime({
    userPrompt: 'take a photo',
    targetDeviceId: cameraProfile.deviceMeta.device_id,
    manifest: cameraManifest,
    worldModel: cameraWorld
  });
  assert(cameraCompiled.status === 'compiled', 'Camera sensor supported prompt should compile.');
  assert(cameraCompiled.taskDsl?.executionMode === 'read_only', 'Camera runtime task should stay read_only.');

  const cameraUnsupported = compileOpenRealityRuntime({
    userPrompt: 'make the camera move the cube',
    targetDeviceId: cameraProfile.deviceMeta.device_id,
    manifest: cameraManifest,
    worldModel: cameraWorld
  });
  assert(cameraUnsupported.status === 'ambiguous' || cameraUnsupported.status === 'unsupported', 'Camera cannot become a manipulator.');
  assert(!cameraUnsupported.taskDsl, 'Unsupported or ambiguous camera manipulation prompt must not emit executable TaskDSL.');

  const mobileNotRunnable = compileOpenRealityRuntime({
    userPrompt: 'navigate to zone A',
    targetDeviceId: 'virtual_mobile_robot',
    manifest: getOpenRealityDeviceManifest('mobile_robot'),
    worldModel: createDefaultWorldModel('virtual_mobile_robot')
  });
  assert(mobileNotRunnable.status === 'not_runnable', 'mobile_robot must remain not_runnable.');

  const conveyorNotRunnable = compileOpenRealityRuntime({
    userPrompt: 'set conveyor speed to fast',
    targetDeviceId: 'virtual_conveyor_belt',
    manifest: getOpenRealityDeviceManifest('conveyor_belt'),
    worldModel: createDefaultWorldModel('virtual_conveyor_belt')
  });
  assert(conveyorNotRunnable.status === 'not_runnable', 'conveyor_belt must remain not_runnable.');

  const plcNotRunnable = compileOpenRealityRuntime({
    userPrompt: 'write PLC output',
    targetDeviceId: 'virtual_plc_cabinet',
    manifest: getOpenRealityDeviceManifest('plc_cabinet'),
    worldModel: createDefaultWorldModel('virtual_plc_cabinet')
  });
  assert(plcNotRunnable.status === 'not_runnable', 'plc_cabinet must remain not_runnable.');

  const labNotRunnable = compileOpenRealityRuntime({
    userPrompt: 'dispense 5ml liquid',
    targetDeviceId: 'virtual_lab_instrument',
    manifest: getOpenRealityDeviceManifest('lab_instrument'),
    worldModel: createDefaultWorldModel('virtual_lab_instrument')
  });
  assert(labNotRunnable.status === 'not_runnable', 'lab_instrument must remain not_runnable.');

  const droneNotRunnable = compileOpenRealityRuntime({
    userPrompt: 'take aerial photo',
    targetDeviceId: 'virtual_drone_unit',
    manifest: getOpenRealityDeviceManifest('drone_unit'),
    worldModel: createDefaultWorldModel('virtual_drone_unit')
  });
  assert(droneNotRunnable.status === 'not_runnable', 'drone_unit must remain not_runnable.');

  const ambiguousPrompt = compileOpenRealityRuntime({
    userPrompt: 'do it',
    targetDeviceId: robotProfile.deviceMeta.device_id,
    manifest: robotManifest,
    worldModel: robotWorld
  });
  assert(ambiguousPrompt.status === 'ambiguous', 'Ambiguous prompt should ask for clarification.');

  const missingObject = compileOpenRealityRuntime({
    userPrompt: 'put the red cube in the back area',
    targetDeviceId: robotProfile.deviceMeta.device_id,
    manifest: robotManifest,
    worldModel: { ...robotWorld, objects: robotWorld.objects.filter((object) => object.id !== 'red_cube') }
  });
  assert(missingObject.status === 'ambiguous', 'Missing object in world model should not be faked.');

  const missingZone = compileOpenRealityRuntime({
    userPrompt: 'put the red cube in the back area',
    targetDeviceId: robotProfile.deviceMeta.device_id,
    manifest: robotManifest,
    worldModel: { ...robotWorld, zones: robotWorld.zones.filter((zone) => zone.id !== 'back_safe_zone') }
  });
  assert(missingZone.status === 'ambiguous', 'Missing target zone in world model should be ambiguous.');

  const readOnlyManipulation = compileOpenRealityRuntime({
    userPrompt: 'put the red cube in the back area',
    targetDeviceId: cameraProfile.deviceMeta.device_id,
    manifest: cameraManifest,
    worldModel: cameraWorld
  });
  assert(readOnlyManipulation.status === 'unsupported' || readOnlyManipulation.status === 'ambiguous', 'Read-only devices cannot manipulate objects.');

  const unknownTargetDevice = compileOpenRealityRuntime({
    userPrompt: 'turn on the light',
    targetDeviceId: robotProfile.deviceMeta.device_id,
    manifest: robotManifest,
    worldModel: robotWorld
  });
  assert(unknownTargetDevice.status === 'unsupported', 'Selected target device cannot silently switch to another capability family.');

  const allManifests = [
    getOpenRealityDeviceManifest('robot_arm'),
    getOpenRealityDeviceManifest('smart_light'),
    getOpenRealityDeviceManifest('camera_sensor'),
    getOpenRealityDeviceManifest('mobile_robot'),
    getOpenRealityDeviceManifest('conveyor_belt'),
    getOpenRealityDeviceManifest('plc_cabinet'),
    getOpenRealityDeviceManifest('lab_instrument'),
    getOpenRealityDeviceManifest('drone_unit'),
    getOpenRealityDeviceManifest('warehouse_rack'),
    getOpenRealityDeviceManifest('sensor_box')
  ];
  assert(allManifests.every((manifest) => manifest.adapter.realAdapterEnabled === false), 'All current manifests must keep realAdapterEnabled=false.');

  console.log('Open Reality Runtime Kernel tests passed.');
}

run();
