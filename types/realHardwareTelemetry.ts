export interface RealHardwareTelemetry {
  connected: boolean;
  /** Fresh read-only hardware:readDistance polling value; null means unavailable. */
  distanceCm: number | null;
  /** Last device-acknowledged command, never a measured physical angle. */
  lastCommandAngle: number | null;
}
