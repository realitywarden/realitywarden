import { DeviceGeometrySchema, DeviceMetaSchema } from '@/lib/schemas/deviceMeta.schema';
import type { DeviceGeometry, DeviceMeta, DeviceProfile, DeviceType } from '@/types/deviceMeta';
import robotArmMeta from '@/profiles/virtual-robot-arm/device.meta.json';
import robotArmGeometry from '@/profiles/virtual-robot-arm/geometry.json';
import mobileRobotMeta from '@/profiles/virtual-mobile-robot/device.meta.json';
import mobileRobotGeometry from '@/profiles/virtual-mobile-robot/geometry.json';
import smartLightMeta from '@/profiles/virtual-smart-light/device.meta.json';
import smartLightGeometry from '@/profiles/virtual-smart-light/geometry.json';
import cameraSensorMeta from '@/profiles/virtual-camera-sensor/device.meta.json';
import cameraSensorGeometry from '@/profiles/virtual-camera-sensor/geometry.json';
import conveyorBeltMeta from '@/profiles/virtual-conveyor-belt/device.meta.json';
import conveyorBeltGeometry from '@/profiles/virtual-conveyor-belt/geometry.json';

function makeProfile(id: string, label: string, meta: unknown, geometry: unknown): DeviceProfile {
  return {
    id,
    label,
    deviceMeta: DeviceMetaSchema.parse(meta) as DeviceMeta,
    geometry: DeviceGeometrySchema.parse(geometry) as DeviceGeometry
  };
}

export class VirtualDeviceRegistry {
  private readonly profiles = new Map<string, DeviceProfile>();

  register(profile: DeviceProfile) {
    this.profiles.set(profile.id, profile);
  }

  get(profileId: string) {
    return this.profiles.get(profileId);
  }

  list() {
    return Array.from(this.profiles.values());
  }

  listByDeviceType(deviceType: DeviceType) {
    return this.list().filter((profile) => profile.deviceMeta.device_type === deviceType);
  }
}

export function createDefaultVirtualDeviceRegistry() {
  const registry = new VirtualDeviceRegistry();
  [
    makeProfile('virtual-robot-arm', 'Virtual Robot Arm', robotArmMeta, robotArmGeometry),
    makeProfile('virtual-mobile-robot', 'Virtual Mobile Robot', mobileRobotMeta, mobileRobotGeometry),
    makeProfile('virtual-smart-light', 'Virtual Smart Light', smartLightMeta, smartLightGeometry),
    makeProfile('virtual-camera-sensor', 'Virtual Camera Sensor', cameraSensorMeta, cameraSensorGeometry),
    makeProfile('virtual-conveyor-belt', 'Virtual Conveyor Belt', conveyorBeltMeta, conveyorBeltGeometry)
  ].forEach((profile) => registry.register(profile));
  return registry;
}
