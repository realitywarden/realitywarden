export type {
  HardwareCapabilityId,
  HardwareCapabilityLimit,
  HardwareCommand,
  HardwareExecuteResult,
  InterlockOverride,
  SensorInterlockRequirement,
  SensorReading,
  TransportFrame,
  TransportResponse
} from './types';
// NOTE (audit 1.1): `./internal/actuation` is deliberately NOT re-exported.
// Only the ActuationTicket TYPE is public (needed to implement
// RealDeviceTransport); the ticket VALUE stays gate-private.
export type { ActuationTicket } from './internal/actuation';
export { TransportOfflineError } from './RealDeviceTransport';
export type { RealDeviceTransport } from './RealDeviceTransport';
export { SerialEsp32Transport, createNodeSerialPort } from './SerialEsp32Transport';
export type { SerialPortLike, SerialEsp32TransportOptions } from './SerialEsp32Transport';
export { Esp32DeviceAdapter, ESP32_SERVO_RIG_CAPABILITIES } from './Esp32DeviceAdapter';
export { HardwareExecutionGate } from './HardwareExecutionGate';
export {
  MedianFilter,
  DistanceInterlock,
  DeviceClockBaseline,
  StuckValueDetector,
  buildConservativeMedianReading
} from './SensorConditioning';
export type { DistanceInterlockOptions, DistanceInterlockState, StuckValueDetectorOptions } from './SensorConditioning';
export type { HardwareGateOutcome, HardwareGateRequest, HardwareGateStatus } from './HardwareExecutionGate';
