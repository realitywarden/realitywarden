import { ipcMain } from 'electron';

/**
 * Real-hardware IPC (v0.3, connection + read-only distance).
 *
 * This is the ONLY main-process surface for the renderer's REAL HARDWARE
 * panel. It deliberately exposes no actuation: the servo command is not
 * reachable from here (enforced by a desktop regression test). Real actuation
 * stays gated behind the runtime's HardwareExecutionGate and the
 * four-scenario device acceptance.
 *
 * The newline-JSON protocol client below mirrors the semantics of
 * `lib/hardware/SerialEsp32Transport` (id-matched responses, hard timeouts,
 * malformed lines are errors — never coerced into success). It is duplicated
 * here because the electron tsconfig rootDir cannot include lib/; when the
 * execution path is wired post-acceptance, this duplication is consolidated.
 *
 * Honesty rules: every failure returns { ok: false, error } with the real
 * reason; there is no retry-and-pretend, no cached reading, no fake state.
 */

interface SerialPortInstanceLike {
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'close' | 'error', listener: (error?: Error) => void): void;
  open(callback: (error: Error | null) => void): void;
  close(callback: (error: Error | null) => void): void;
  write(chunk: string, callback: (error: Error | null | undefined) => void): void;
  isOpen: boolean;
}

interface SerialPortModuleLike {
  SerialPort: {
    new (options: { path: string; baudRate: number; autoOpen: boolean }): SerialPortInstanceLike;
    list(): Promise<Array<{ path: string; manufacturer?: string }>>;
  };
}

function loadSerialPortModule(): SerialPortModuleLike | { error: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('serialport') as SerialPortModuleLike;
  } catch {
    return {
      error: 'serialport_not_installed: run `npm install serialport` in the app directory'
    };
  }
}

interface PendingRequest {
  resolve: (value: { ok: boolean; error?: string; data?: Record<string, unknown> }) => void;
  timer: ReturnType<typeof setTimeout>;
}

class HardwareConnection {
  private port: SerialPortInstanceLike | null = null;
  private buffer = '';
  private requestSeq = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private operationQueue: Promise<void> = Promise.resolve();

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async listPorts() {
    const loaded = loadSerialPortModule();
    if ('error' in loaded) return { ok: false, error: loaded.error };
    try {
      const ports = await loaded.SerialPort.list();
      return {
        ok: true,
        ports: ports.map((port) => ({ path: port.path, label: port.manufacturer }))
      };
    } catch (error) {
      return { ok: false, error: `list failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  connect(portPath: string) {
    return this.enqueue(() => this.connectExclusive(portPath));
  }

  private async connectExclusive(portPath: string) {
    if (typeof portPath !== 'string' || portPath.trim().length === 0) {
      return { ok: false, error: 'invalid serial port path' };
    }
    const loaded = loadSerialPortModule();
    if ('error' in loaded) return { ok: false, error: loaded.error };
    await this.disconnectExclusive();
    const port = new loaded.SerialPort({ path: portPath, baudRate: 115200, autoOpen: false });
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((error) => (error ? reject(error) : resolve()));
      });
    } catch (error) {
      return { ok: false, error: `open failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    this.port = port;
    port.on('data', (chunk) => {
      if (this.port === port) this.handleData(chunk.toString('utf8'));
    });
    port.on('close', () => this.handlePortClosed(port, 'port closed'));
    port.on('error', () => {
      if (this.port === port) this.failAllPending('port error');
    });
    // Opening the port toggles DTR and resets the ESP32; give the firmware
    // time to boot before the handshake instead of reporting a false timeout.
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const handshake = await this.request('read_distance', 3000);
    if (!handshake.ok) {
      await this.disconnectExclusive();
      return { ok: false, error: `handshake failed: ${handshake.error ?? 'no valid response'}` };
    }
    const distance = handshake.data?.distanceCm;
    return { ok: true, distanceCm: typeof distance === 'number' ? distance : undefined };
  }

  async readDistance() {
    if (!this.port || !this.port.isOpen) {
      return { ok: false, error: 'hardware offline: not connected' };
    }
    const response = await this.request('read_distance', 3000);
    if (!response.ok) return { ok: false, error: response.error ?? 'read failed' };
    const distance = response.data?.distanceCm;
    if (typeof distance !== 'number') {
      return { ok: false, error: 'device responded without a numeric distanceCm' };
    }
    return { ok: true, distanceCm: distance };
  }

  disconnect() {
    return this.enqueue(() => this.disconnectExclusive());
  }

  private async disconnectExclusive() {
    this.failAllPending('disconnected');
    const port = this.port;
    this.port = null;
    this.buffer = '';
    if (port && port.isOpen) {
      await new Promise<void>((resolve) => {
        port.close(() => resolve());
      });
    }
    return { ok: true };
  }

  private handlePortClosed(port: SerialPortInstanceLike, reason: string) {
    // Events from a previously disconnected port must never tear down a newer
    // connection or reject that connection's pending requests.
    if (this.port !== port) return;
    this.port = null;
    this.buffer = '';
    this.failAllPending(reason);
  }

  private request(cmd: string, timeoutMs: number) {
    return new Promise<{ ok: boolean; error?: string; data?: Record<string, unknown> }>((resolve) => {
      const port = this.port;
      if (!port || !port.isOpen) {
        resolve({ ok: false, error: 'hardware offline: not connected' });
        return;
      }
      const id = `ui-${Date.now()}-${this.requestSeq += 1}`;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: `device response timeout after ${timeoutMs}ms` });
      }, timeoutMs);
      this.pending.set(id, { resolve, timer });
      port.write(`${JSON.stringify({ id, cmd })}\n`, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          resolve({ ok: false, error: `serial write failed: ${error.message}` });
        }
      });
    });
  }

  private handleData(chunk: string) {
    this.buffer += chunk;
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.length > 0) this.handleLine(line);
      newlineIndex = this.buffer.indexOf('\n');
    }
  }

  private handleLine(line: string) {
    let parsed: { id?: string; ok?: boolean; error?: string; data?: Record<string, unknown> };
    try {
      parsed = JSON.parse(line);
    } catch {
      return; // malformed line: matching request will time out honestly
    }
    if (!parsed.id) return;
    const entry = this.pending.get(parsed.id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(parsed.id);
    entry.resolve({
      ok: parsed.ok === true,
      error: parsed.ok === true ? undefined : parsed.error ?? 'device reported failure',
      data: parsed.data
    });
  }

  private failAllPending(reason: string) {
    this.pending.forEach((entry) => {
      clearTimeout(entry.timer);
      entry.resolve({ ok: false, error: reason });
    });
    this.pending.clear();
  }
}

const connection = new HardwareConnection();

export function registerHardwareIpc() {
  ipcMain.handle('hardware:listPorts', () => connection.listPorts());
  ipcMain.handle('hardware:connect', (_event, payload: { portPath: string }) =>
    connection.connect(payload.portPath));
  ipcMain.handle('hardware:readDistance', () => connection.readDistance());
  ipcMain.handle('hardware:disconnect', () => connection.disconnect());
}
