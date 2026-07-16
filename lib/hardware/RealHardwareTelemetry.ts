import type { RealHardwareTelemetry } from '../../types/realHardwareTelemetry';

/**
 * Creates the only telemetry shape allowed to enter the 3D REAL mirror.
 * Disconnection and invalid readings erase current values; cached values are
 * never presented as live state.
 */
export function visibleRealHardwareTelemetry(
  connected: boolean,
  distanceCm: number | null,
  lastCommandAngle: number | null
): RealHardwareTelemetry {
  if (!connected) return { connected: false, distanceCm: null, lastCommandAngle: null };
  return {
    connected: true,
    distanceCm: typeof distanceCm === 'number' && Number.isFinite(distanceCm) ? distanceCm : null,
    lastCommandAngle: typeof lastCommandAngle === 'number' && Number.isFinite(lastCommandAngle) ? lastCommandAngle : null
  };
}
