import { TransportOfflineError } from './RealDeviceTransport';
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
  private buffer = '';
  private connected = false;
  private lastProtocolError: string | null = null;
  private readonly pending = new Map<
    string,
    { resolve: (response: TransportResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly port: SerialPortLike,
    options: SerialEsp32TransportOptions = {}
  ) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 2000;
    this.port.onData((chunk) => this.handleData(chunk));
    this.port.onClose(() => this.handleClose());
  }

  async connect(): Promise<void> {
    await this.port.open();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.failAllPending(new TransportOfflineError('transport disconnected'));
    await this.port.close();
  }

  isConnected(): boolean {
    return this.connected && this.port.isOpen();
  }

  getLastProtocolError(): string | null {
    return this.lastProtocolError;
  }

  async send(frame: TransportFrame): Promise<TransportResponse> {
    if (!this.isConnected()) {
      throw new TransportOfflineError();
    }
    const line = `${JSON.stringify(frame)}\n`;
    const responsePromise = new Promise<TransportResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(frame.id);
        reject(new Error(`device response timeout after ${this.requestTimeoutMs}ms (id=${frame.id})`));
      }, this.requestTimeoutMs);
      this.pending.set(frame.id, { resolve, reject, timer });
    });
    try {
      await this.port.write(line);
    } catch (error) {
      const entry = this.pending.get(frame.id);
      if (entry) {
        clearTimeout(entry.timer);
        this.pending.delete(frame.id);
      }
      throw new TransportOfflineError(
        `serial write failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return responsePromise;
  }

  private handleData(chunk: string) {
    this.buffer += chunk;
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        this.handleLine(line);
      }
      newlineIndex = this.buffer.indexOf('\n');
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
    this.failAllPending(new TransportOfflineError('serial port closed'));
  }

  private failAllPending(error: Error) {
    for (const entry of Array.from(this.pending.values())) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this.pending.clear();
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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
