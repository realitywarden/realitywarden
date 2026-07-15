import { ACTUATION_TICKET, isActuationCommand } from './internal/actuation';
import type { ActuationTicket } from './internal/actuation';
import { TransportFrameRejectedError, TransportOfflineError } from './RealDeviceTransport';
import type { RealDeviceTransport } from './RealDeviceTransport';
import type { TransportFrame, TransportResponse } from './types';

/**
 * Minimal serial-port surface used by SerialEsp32Transport.
 * The real implementation is provided by the `serialport` npm package
 * (see createNodeSerialPort). Tests inject a fake.
 */
export interface SerialPortLike {
  open(): Promise<void>;
  close(): Promise<void>;
  write(chunk: string): Promise<void>;
  onData(listener: (chunk: string) => void): void;
  onClose(listener: () => void): void;
  isOpen(): boolean;
}

export interface SerialEsp32TransportOptions {
  /** Per-request timeout. Default 2000ms. */
  requestTimeoutMs?: number;
}

/**
 * Newline-delimited JSON protocol over a serial port to an ESP32.
 *
 * Host -> device: {"id":"...","cmd":"move_to_angle","args":{"angle":45}}\n
 * Device -> host: {"id":"...","ok":true,"data":{"angle":45}}\n
 *
 * Responses are matched to requests by id. Unmatched or malformed lines are
 * counted and surfaced via lastProtocolError, never silently coerced into a
 * success.
 */
export class SerialEsp32Transport implements RealDeviceTransport {
  private static readonly MAX_LINE_LENGTH = 4096;
  // Matches the checked-in firmware's bounded host-request line buffer.
  private static readonly MAX_FRAME_LENGTH_BYTES = 512;
  private buffer = '';
  private discardingOversizedLine = false;
  private connected = false;
  private lastProtocolError: string | null = null;
  private readonly pending = new Map<
    string,
    { resolve: (response: TransportResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  /** IDs whose response ownership became ambiguous after timeout/write/close. */
  private readonly retiredRequestIds = new Set<string>();
  private readonly requestTimeoutMs: number;
  private lifecycleQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly port: SerialPortLike,
    options: SerialEsp32TransportOptions = {}
  ) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 2000;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error(`requestTimeoutMs must be a finite positive number, got ${this.requestTimeoutMs}`);
    }
    this.port.onData((chunk) => this.handleData(chunk));
    this.port.onClose(() => this.handleClose());
  }

  connect(): Promise<void> {
    return this.enqueueLifecycle(async () => {
      if (this.isConnected()) return;
      this.resetParser();
      this.lastProtocolError = null;
      await this.port.open();
      if (!this.port.isOpen()) {
        throw new TransportOfflineError('serial port closed while opening');
      }
      this.connected = true;
    });
  }

  disconnect(): Promise<void> {
    return this.enqueueLifecycle(async () => {
      this.connected = false;
      this.failAllPending(new TransportOfflineError('transport disconnected'));
      this.resetParser();
      if (this.port.isOpen()) {
        await this.port.close();
      }
    });
  }

  isConnected(): boolean {
    return this.connected && this.port.isOpen();
  }

  getLastProtocolError(): string | null {
    return this.lastProtocolError;
  }

  async send(frame: TransportFrame): Promise<TransportResponse> {
    // Structural single-path enforcement (audit 1.1): the plain send() surface
    // refuses actuation frames BEFORE anything can reach the wire. Only the
    // execution gate, holding the private ticket, may actuate via
    // sendActuation(). Refused, never rerouted — no silent fallback.
    if (isActuationCommand(frame.cmd)) {
      throw new Error(
        `actuation_requires_gate: refusing to send actuation command "${frame.cmd}" via send(); `
        + 'actuation frames may only travel through HardwareExecutionGate'
      );
    }
    return this.dispatch(frame);
  }

  async sendActuation(frame: TransportFrame, ticket: ActuationTicket): Promise<TransportResponse> {
    if (ticket !== ACTUATION_TICKET) {
      // Wrong or forged ticket: refuse before the frame exists on any buffer.
      throw new Error(
        'invalid_actuation_ticket: sendActuation() requires the gate-private actuation ticket'
      );
    }
    return this.dispatch(frame);
  }

  private dispatch(frame: TransportFrame): Promise<TransportResponse> {
    if (!this.isConnected()) {
      return Promise.reject(new TransportOfflineError());
    }
    if (typeof frame.id !== 'string' || frame.id.trim().length === 0) {
      return Promise.reject(new TransportFrameRejectedError('invalid_request_id: frame id must be a non-empty string'));
    }
    if (this.pending.has(frame.id)) {
      return Promise.reject(new TransportFrameRejectedError(
        `duplicate_request_id: request id already pending (id=${frame.id})`
      ));
    }
    if (this.retiredRequestIds.has(frame.id)) {
      return Promise.reject(new TransportFrameRejectedError(
        `reused_request_id: request id was retired after an ambiguous request outcome (id=${frame.id})`
      ));
    }
    let line: string;
    try {
      line = `${JSON.stringify(frame)}\n`;
    } catch (error) {
      return Promise.reject(new TransportFrameRejectedError(
        `invalid_transport_frame: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
    const frameBytes = new TextEncoder().encode(line.slice(0, -1)).byteLength;
    if (frameBytes > SerialEsp32Transport.MAX_FRAME_LENGTH_BYTES) {
      return Promise.reject(new TransportFrameRejectedError(
        `outgoing_frame_too_large: ${frameBytes} bytes exceeds firmware limit ${SerialEsp32Transport.MAX_FRAME_LENGTH_BYTES}`
      ));
    }

    return new Promise<TransportResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(frame.id);
        this.retiredRequestIds.add(frame.id);
        reject(new Error(`device response timeout after ${this.requestTimeoutMs}ms (id=${frame.id})`));
      }, this.requestTimeoutMs);
      this.pending.set(frame.id, { resolve, reject, timer });

      try {
        void this.port.write(line).catch((error: unknown) => {
          const entry = this.pending.get(frame.id);
          if (entry) {
            clearTimeout(entry.timer);
            this.pending.delete(frame.id);
            this.retiredRequestIds.add(frame.id);
            reject(new TransportOfflineError(
              `serial write failed: ${error instanceof Error ? error.message : String(error)}`
            ));
          }
        });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(frame.id);
        this.retiredRequestIds.add(frame.id);
        reject(new TransportOfflineError(
          `serial write failed: ${error instanceof Error ? error.message : String(error)}`
        ));
      }
    });
  }

  private handleData(chunk: string) {
    if (this.discardingOversizedLine) {
      const newlineIndex = chunk.indexOf('\n');
      if (newlineIndex < 0) return;
      this.discardingOversizedLine = false;
      chunk = chunk.slice(newlineIndex + 1);
    }
    this.buffer += chunk;
    if (this.buffer.length > SerialEsp32Transport.MAX_LINE_LENGTH && !this.buffer.includes('\n')) {
      this.lastProtocolError = `oversized device line discarded (>${SerialEsp32Transport.MAX_LINE_LENGTH} chars)`;
      this.buffer = '';
      this.discardingOversizedLine = true;
      return;
    }
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        if (line.length > SerialEsp32Transport.MAX_LINE_LENGTH) {
          this.lastProtocolError = `oversized device line discarded (>${SerialEsp32Transport.MAX_LINE_LENGTH} chars)`;
        } else {
          this.handleLine(line);
        }
      }
      newlineIndex = this.buffer.indexOf('\n');
    }
    if (this.buffer.length > SerialEsp32Transport.MAX_LINE_LENGTH) {
      this.lastProtocolError = `oversized device line discarded (>${SerialEsp32Transport.MAX_LINE_LENGTH} chars)`;
      this.buffer = '';
      this.discardingOversizedLine = true;
    }
  }

  private handleLine(line: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      this.lastProtocolError = `malformed device line: ${line.slice(0, 120)}`;
      return;
    }
    if (
      typeof parsed !== 'object'
      || parsed === null
      || typeof (parsed as { id?: unknown }).id !== 'string'
      || typeof (parsed as { ok?: unknown }).ok !== 'boolean'
    ) {
      this.lastProtocolError = `device line missing id/ok: ${line.slice(0, 120)}`;
      return;
    }
    const response = parsed as TransportResponse;
    const entry = this.pending.get(response.id);
    if (!entry) {
      this.lastProtocolError = `unmatched device response id: ${response.id}`;
      return;
    }
    clearTimeout(entry.timer);
    this.pending.delete(response.id);
    entry.resolve(response);
  }

  private handleClose() {
    this.connected = false;
    this.resetParser();
    this.failAllPending(new TransportOfflineError('serial port closed'));
  }

  private failAllPending(error: Error) {
    for (const [id, entry] of Array.from(this.pending.entries())) {
      clearTimeout(entry.timer);
      this.retiredRequestIds.add(id);
      entry.reject(error);
    }
    this.pending.clear();
  }

  private resetParser() {
    this.buffer = '';
    this.discardingOversizedLine = false;
  }

  private enqueueLifecycle(operation: () => Promise<void>): Promise<void> {
    const result = this.lifecycleQueue.then(operation, operation);
    this.lifecycleQueue = result.then(() => undefined, () => undefined);
    return result;
  }
}

/**
 * Create a SerialPortLike backed by the `serialport` npm package.
 *
 * The dependency is loaded lazily so the web/simulation bundle never needs it.
 * If the package is not installed, this throws an explicit error — it must
 * NOT silently fall back to a mock (core invariant: no silent fallback).
 */
export function createNodeSerialPort(portPath: string, baudRate = 115200): SerialPortLike {
  let SerialPortCtor: new (options: { path: string; baudRate: number; autoOpen: boolean }) => {
    open(cb: (error?: Error | null) => void): void;
    close(cb: (error?: Error | null) => void): void;
    write(chunk: string, cb: (error?: Error | null) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    isOpen: boolean;
  };
  try {
    const nodeRequire = eval('require') as (id: string) => { SerialPort: typeof SerialPortCtor };
    SerialPortCtor = nodeRequire('serialport').SerialPort;
  } catch {
    throw new Error(
      'Real hardware serial support requires the "serialport" package. '
      + 'Install it with `npm install serialport`. '
      + 'Refusing to continue without it (no silent fallback).'
    );
  }

  const port = new SerialPortCtor({ path: portPath, baudRate, autoOpen: false });
  const dataListeners: Array<(chunk: string) => void> = [];
  const closeListeners: Array<() => void> = [];
  port.on('data', (raw: unknown) => {
    const chunk = typeof raw === 'string' ? raw : String(raw);
    dataListeners.forEach((listener) => listener(chunk));
  });
  port.on('close', () => {
    closeListeners.forEach((listener) => listener());
  });

  return {
    open: () =>
      new Promise<void>((resolve, reject) => {
        port.open((error) => (error ? reject(error) : resolve()));
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        port.close((error) => (error ? reject(error) : resolve()));
      }),
    write: (chunk: string) =>
      new Promise<void>((resolve, reject) => {
        port.write(chunk, (error) => (error ? reject(error) : resolve()));
      }),
    onData: (listener) => dataListeners.push(listener),
    onClose: (listener) => closeListeners.push(listener),
    isOpen: () => port.isOpen
  };
}
