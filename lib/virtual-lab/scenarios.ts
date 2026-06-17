import type { DeviceScenario } from './DeviceScenario';
import robotArm from '@/scenarios/robot-arm-pick-place.json';
import robotArmUnsafe from '@/scenarios/robot-arm-pick-place-unsafe.json';
import mobileRobot from '@/scenarios/mobile-robot-navigation.json';
import mobileRobotUnsafe from '@/scenarios/mobile-robot-navigation-unsafe.json';
import smartLight from '@/scenarios/smart-light-control.json';
import smartLightUnsafe from '@/scenarios/smart-light-control-unsafe.json';
import cameraSensor from '@/scenarios/camera-sensor-check.json';
import cameraSensorUnsafe from '@/scenarios/camera-sensor-check-unsafe.json';
import conveyorBelt from '@/scenarios/conveyor-belt-sort.json';
import conveyorBeltUnsafe from '@/scenarios/conveyor-belt-sort-unsafe.json';

export const deviceScenarios = [
  robotArm,
  robotArmUnsafe,
  mobileRobot,
  mobileRobotUnsafe,
  smartLight,
  smartLightUnsafe,
  cameraSensor,
  cameraSensorUnsafe,
  conveyorBelt,
  conveyorBeltUnsafe
] as DeviceScenario[];

export function getScenarioForProfile(profileId: string, mode: 'safe' | 'unsafe' = 'safe') {
  const exact = deviceScenarios.find((scenario) => scenario.device_profile === profileId && scenario.mode === mode);
  if (exact) return exact;

  const normalized = profileId.toLowerCase();
  const fallbackProfileId =
    normalized.includes('mobile') || normalized.includes('agv') || normalized.includes('amr')
      ? 'virtual-mobile-robot'
      : normalized.includes('light')
        ? 'virtual-smart-light'
        : normalized.includes('camera') || normalized.includes('ptz')
          ? 'virtual-camera-sensor'
          : normalized.includes('conveyor') || normalized.includes('belt')
            ? 'virtual-conveyor-belt'
            : 'virtual-robot-arm';

  return deviceScenarios.find((scenario) => scenario.device_profile === fallbackProfileId && scenario.mode === mode) ?? deviceScenarios[0];
}
