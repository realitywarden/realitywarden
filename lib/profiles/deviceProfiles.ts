import { createDefaultVirtualDeviceRegistry } from '@/lib/virtual-lab/VirtualDeviceRegistry';
import type { DeviceProfile } from '@/types/deviceMeta';

export const deviceProfiles = createDefaultVirtualDeviceRegistry().list();

export type DeviceProfileId = (typeof deviceProfiles)[number]['id'];

export function getDeviceProfile(profileId: string): DeviceProfile {
  return deviceProfiles.find((profile) => profile.id === profileId) ?? deviceProfiles[0];
}
