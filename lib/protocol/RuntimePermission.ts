import type { DeviceType } from '@/types/deviceMeta';

export interface RuntimePermission {
  id:
    | 'simulation.run'
    | 'simulation.audit'
    | 'real_device.connect'
    | 'real_device.execute'
    | 'adapter.emergency_stop';
  allowed: boolean;
  mode: 'simulation' | 'real_device';
  reason: string;
}

export function buildRuntimePermissions(deviceType: DeviceType, publicAlphaRunnable: boolean): RuntimePermission[] {
  return [
    {
      id: 'simulation.run',
      allowed: publicAlphaRunnable,
      mode: 'simulation',
      reason: publicAlphaRunnable ? `${deviceType} is runnable in Public Alpha.` : `${deviceType} remains Coming Soon in Public Alpha.`
    },
    {
      id: 'simulation.audit',
      allowed: true,
      mode: 'simulation',
      reason: 'All protocol assets must support audit and lab reporting.'
    },
    {
      id: 'real_device.connect',
      allowed: false,
      mode: 'real_device',
      reason: 'Real device execution is outside the Public Alpha boundary.'
    },
    {
      id: 'real_device.execute',
      allowed: false,
      mode: 'real_device',
      reason: 'No production hardware control is exposed in Public Alpha.'
    },
    {
      id: 'adapter.emergency_stop',
      allowed: publicAlphaRunnable,
      mode: 'simulation',
      reason: 'Runnable protocol assets must preserve stop semantics even in simulation.'
    }
  ];
}
