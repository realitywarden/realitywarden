export type {
  HardwareCapabilityId,
  HardwareArgumentLimit,
  HardwareCapabilityLimit,
  HardwareCommand,
  HardwareExecuteResult,
  HardwareExecutionEvidence,
  HardwareSignalState,
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
export { TransportFrameRejectedError, TransportOfflineError } from './RealDeviceTransport';
export type { RealDeviceTransport } from './RealDeviceTransport';
export { SerialEsp32Transport, createNodeSerialPort } from './SerialEsp32Transport';
export type { SerialPortLike, SerialEsp32TransportOptions } from './SerialEsp32Transport';
export { Esp32DeviceAdapter, ESP32_SERVO_RIG_CAPABILITIES } from './Esp32DeviceAdapter';
export { HardwareExecutionGate } from './HardwareExecutionGate';
export { DistanceSensorPollingService } from './SensorPollingService';
export type {
  DistanceSensorPollingOptions,
  DistanceSensorReader,
  SensorEvidenceSnapshot,
  SensorEvidenceSubscriber,
  SensorPollingState
} from './SensorPollingService';
export { HardwareActionSequenceRunner } from './HardwareActionSequenceRunner';
export type {
  HardwareActionSequenceOptions,
  HardwareActionSequenceResult,
  HardwareActionSequenceStatus,
  HardwareActionSequenceStepResult,
  SensorEvidencePoller
} from './HardwareActionSequenceRunner';
export { adviceForFailure, interpretProbe, EXPECTED_FIRMWARE, EXPECTED_FIRMWARE_VERSION } from './SetupAdvisor';
export type { FirmwareIdentity, SetupAdvice, AdviceSeverity } from './SetupAdvisor';
export {
  MedianFilter,
  DistanceInterlock,
  DeviceClockBaseline,
  StuckValueDetector,
  buildConservativeMedianReading
} from './SensorConditioning';
export type { DistanceInterlockOptions, DistanceInterlockState, StuckValueDetectorOptions } from './SensorConditioning';
export type { HardwareGateOutcome, HardwareGateRequest, HardwareGateStatus } from './HardwareExecutionGate';
