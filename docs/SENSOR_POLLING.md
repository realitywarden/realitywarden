# Sensor Polling and Multi-Step Interlocks

Status: implemented for the v0.4 real-hardware core.

This model replaces assembly of one sensor batch immediately before execution.
It does not create a new execution path: every primitive command still reaches
hardware only through `HardwareExecutionGate` and its private ticket.

## Runtime chain

```text
Esp32DeviceAdapter.readDistanceDetailed
  -> DistanceSensorPollingService
  -> fresh SensorEvidenceSnapshot generation
  -> HardwareActionSequenceRunner
  -> HardwareExecutionGate
  -> ticketed adapter/transport
```

`DistanceSensorPollingService` supports both interval polling (`start`/`stop`)
and subscriptions. A subscriber receives defensive copies and cannot mutate
the evidence used by the gate. Concurrent `pollOnce` calls share one in-flight
read so serial responses cannot be reordered by overlapping requests.

## Fail-closed behavior

- A read failure publishes an empty evidence set immediately. The last good
  reading is never reused across a failed poll.
- Host and device timestamps remain attached to conditioned readings.
- A regressing device clock latches the sensor as frozen. Its typed raw
  reading is retained only so `SafetyMonitor` can emit `sensor_frozen`; the
  accompanying frozen set makes that reading unusable for authorization.
- Repeated identical values with a non-advancing device clock use the existing
  `StuckValueDetector` and latch as frozen.
- Frozen and clock-fault latches clear only through the explicit
  `resetSensorLatch()` operation, after which fresh evidence is still required.
- A newly closer distance is never hidden by a median window: the interlock
  consumes the lower of the conditioned median and the latest sample. This can
  only tighten the minimum-distance decision.

## Multi-step actions

`HardwareActionSequenceRunner` accepts already expanded primitive commands,
with the same 16-step maximum as Action Manifest. Immediately before every
primitive it obtains a new sensor generation and calls `HardwareExecutionGate`.

The sequence terminates after the first blocked, failed, or cancelled step.
The blocked primitive never reaches `adapter.execute`, and no later primitive
is polled or sent. Sequence results always carry `executionMode: real_hardware`;
individual gate results retain the existing signal and open-loop evidence.

## Non-goals

- No background polling result grants execution authority.
- No subscriber can approve or override an interlock.
- No cached reading is used as a fallback.
- This does not claim physical outcome verification for the SG90 open-loop rig.
