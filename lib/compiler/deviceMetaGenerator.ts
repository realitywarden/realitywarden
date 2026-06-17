import type { DeviceMeta } from '@/types/deviceMeta';
import { getDeviceProfile } from '@/lib/profiles/deviceProfiles';

export function generateDeviceMeta(profileId = 'generic-robot-arm'): DeviceMeta {
  return getDeviceProfile(profileId).deviceMeta;
}
