import { ipcMain } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Real-hardware IPC (v0.3, connection + read-only distance).
 *
 * This is the ONLY main-process surface for the renderer's REAL HARDWARE
 * panel. Actuation exists here in exactly ONE form: executeRealAngle(), which
 * routes through the compiled HardwareExecutionGate chain and stays
 * real_execution_locked until the four-scenario acceptance evidence exists
 * (desktop regression enforces both properties). This file never hand-rolls
 * an actuation frame.
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

  /**
   * Read-only device probe: open -> boot wait -> diagnose_hardware (with a
   * read_distance fallback for legacy firmware) -> close. Never actuates.
   * The renderer interprets the raw result via lib/hardware/SetupAdvisor.
   */
  probe(portPath: string) {
    return this.enqueue(() => this.probeExclusive(portPath));
  }

  private async probeExclusive(portPath: string) {
    if (typeof portPath !== 'string' || portPath.trim().length === 0) {
      return { ok: false as const, error: 'invalid serial port path' };
    }
    const loaded = loadSerialPortModule();
    if ('error' in loaded) return { ok: false as const, error: loaded.error };
    await this.disconnectExclusive();
    const port = new loaded.SerialPort({ path: portPath, baudRate: 115200, autoOpen: false });
    try {
      await new Promise<void>((resolve, reject) => {
        port.open((error) => (error ? reject(error) : resolve()));
      });
    } catch (error) {
      return { ok: false as const, error: `open failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    this.port = port;
    port.on('data', (chunk) => {
      if (this.port === port) this.handleData(chunk.toString('utf8'));
    });
    port.on('close', () => this.handlePortClosed(port, 'port closed'));
    port.on('error', () => {
      if (this.port === port) this.failAllPending('port error');
    });
    try {
      // DTR toggle resets the ESP32; wait for the firmware to boot.
      await new Promise((resolve) => setTimeout(resolve, 1800));
      const diagnose = await this.request('diagnose_hardware', 3000);
      if (diagnose.ok) {
        return { ok: true as const, diagnoseOk: true as const, diagnoseData: diagnose.data };
      }
      // Legacy firmware (pre-diagnostics) answers read_distance but not
      // diagnose_hardware. Distinguish that from plain silence.
      const legacyRead = await this.request('read_distance', 3000);
      if (!legacyRead.ok && (diagnose.error ?? '').includes('timeout')) {
        return { ok: false as const, error: diagnose.error ?? 'no valid response' };
      }
      return {
        ok: true as const,
        diagnoseOk: false as const,
        diagnoseError: diagnose.error,
        legacyReadOk: legacyRead.ok,
        legacyDeviceMs: typeof legacyRead.data?.deviceMs === 'number'
      };
    } finally {
      await this.disconnectExclusive();
    }
  }

  /** Probe every listed port sequentially; stop at the first identified device. */
  autoDetect() {
    return this.enqueue(async () => {
      const listed = await this.listPorts();
      if (!listed.ok || !('ports' in listed) || !listed.ports) {
        return { ok: false as const, error: 'error' in listed && listed.error ? listed.error : 'list ports failed' };
      }
      const results: Array<Record<string, unknown>> = [];
      for (const port of listed.ports) {
        const probe = await this.probeExclusive(port.path);
        results.push({ path: port.path, label: port.label, ...probe });
        if ('diagnoseOk' in probe && probe.diagnoseOk === true) break;
      }
      return { ok: true as const, results };
    });
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

/**
 * REAL EXECUTION service (product path, owner-approved 2026-07-11).
 *
 * Runs the SAME compiled safety chain the CLI demo and the invariant tests
 * run - SafetyMonitor -> HardwareExecutionGate -> Esp32DeviceAdapter ->
 * SerialEsp32Transport - loaded from dist-electron-runtime (built by
 * scripts/build-electron.cjs). No protocol logic is duplicated here and no
 * actuation frame is ever hand-rolled in this file: the gate chain is the
 * only path, so every invariant (blocked => zero frames, ticket enforcement,
 * default-block, honest audit) applies to UI execution identically.
 *
 * LOCK: execution stays disabled (real_execution_locked) until the
 * four-scenario acceptance evidence exists in docs/acceptance/evidence/
 * (>= 4 .json files) or ORS_REAL_EXECUTION=enabled is set explicitly for
 * bench work. Every call additionally requires confirm:true from the UI.
 */
const APP_ROOT = path.join(__dirname, '..', '..');
const EVIDENCE_DIR = path.join(APP_ROOT, 'docs', 'acceptance', 'evidence');
const RUNTIME_LIB = path.join(APP_ROOT, 'dist-electron-runtime', 'lib');

function evidenceCount(): number {
  try {
    return fs.readdirSync(EVIDENCE_DIR).filter((name) => name.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

function executionLock(): { locked: boolean; reason?: string; evidenceCount: number } {
  const count = evidenceCount();
  if (process.env.ORS_REAL_EXECUTION === 'enabled') {
    return { locked: false, evidenceCount: count };
  }
  if (count >= 4) return { locked: false, evidenceCount: count };
  return {
    locked: true,
    evidenceCount: count,
    reason: `real_execution_locked: four-scenario acceptance evidence required (${count}/4 json files in docs/acceptance/evidence/). Run the acceptance per docs/acceptance/OPERATOR_CARD.md, or set ORS_REAL_EXECUTION=enabled for supervised bench work.`
  };
}

interface RuntimeHardwareModule {
  createNodeSerialPort(portPath: string, baudRate?: number): unknown;
  SerialEsp32Transport: new (port: unknown, options: { requestTimeoutMs: number }) => {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
  };
  Esp32DeviceAdapter: new (transport: unknown) => {
    readDistance(sensorId?: string): Promise<unknown | null>;
    readDistanceDetailed(sensorId?: string): Promise<{ reading: unknown | null; error?: string }>;
  };
  HardwareExecutionGate: new (adapter: unknown) => {
    run(request: unknown): Promise<{
      status: 'executed' | 'failed' | 'blocked';
      reason: string;
      executionMode: string;
      result: { ok: boolean; signalSent: boolean; detail: string };
    }>;
    getAuditLog(): { list(): unknown[] };
  };
  ESP32_SERVO_RIG_CAPABILITIES: unknown[];
  buildConservativeMedianReading(readings: unknown[]): { value: number } | null;
}

function loadRuntimeHardware(): RuntimeHardwareModule | { error: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(path.join(RUNTIME_LIB, 'hardware')) as RuntimeHardwareModule;
  } catch (error) {
    return {
      error: 'runtime_chain_unavailable: compiled safety chain missing. Rebuild the desktop app (npm run desktop:dev / node scripts/build-electron.cjs). '
        + `Underlying: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function executeRealAngle(payload: { portPath?: string; angle?: number; confirm?: boolean }) {
  const lock = executionLock();
  if (lock.locked) return { ok: false, error: lock.reason };
  if (payload.confirm !== true) {
    return { ok: false, error: 'confirmation_required: the UI must submit an explicit operator confirmation' };
  }
  const angle = payload.angle;
  if (typeof angle !== 'number' || !Number.isFinite(angle)) {
    return { ok: false, error: 'invalid_angle: numeric angle required' };
  }
  const portPath = payload.portPath;
  if (typeof portPath !== 'string' || portPath.trim().length === 0) {
    return { ok: false, error: 'invalid serial port path' };
  }
  const runtime = loadRuntimeHardware();
  if ('error' in runtime) return { ok: false, error: runtime.error };

  // The panel's read-only client must release the port before the real chain
  // opens it; the UI reconnects afterwards.
  await connection.disconnect();

  const transport = new runtime.SerialEsp32Transport(runtime.createNodeSerialPort(portPath, 115200), { requestTimeoutMs: 3000 });
  try {
    await transport.connect();
  } catch (error) {
    return { ok: false, error: `open failed: ${error instanceof Error ? error.message : String(error)}` };
  }
  try {
    // ESP32 reboots on DTR toggle; wait for the firmware prompt window.
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const adapter = new runtime.Esp32DeviceAdapter(transport);
    const gate = new runtime.HardwareExecutionGate(adapter);

    const readings: unknown[] = [];
    const readErrors: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const detailed = await adapter.readDistanceDetailed('hc-sr04');
      if (detailed.reading) readings.push(detailed.reading);
      else if (detailed.error) readErrors.push(detailed.error);
    }
    // Conservative median (oldest timestamps win). If no valid reading exists
    // the gate default-blocks with sensor_missing - exactly like the demo.
    const median = runtime.buildConservativeMedianReading(readings);
    const outcome = await gate.run({
      command: {
        id: `ui-exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        deviceId: 'esp32-servo-rig',
        capabilityId: 'move_to_angle',
        args: { angle }
      },
      capabilityLimits: runtime.ESP32_SERVO_RIG_CAPABILITIES,
      sensorReadings: median ? [median] : []
    });
    return {
      ok: outcome.result.ok,
      status: outcome.status,
      reason: outcome.reason,
      executionMode: outcome.executionMode,
      signalSent: outcome.result.signalSent,
      detail: outcome.result.detail,
      distanceCm: median ? median.value : undefined,
      readErrors,
      audit: gate.getAuditLog().list()
    };
  } catch (error) {
    return { ok: false, error: `execution failed: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    await transport.disconnect().catch(() => undefined);
  }
}

const connection = new HardwareConnection();

export function registerHardwareIpc() {
  ipcMain.handle('hardware:listPorts', () => connection.listPorts());
  ipcMain.handle('hardware:connect', (_event, payload: { portPath: string }) =>
    connection.connect(payload.portPath));
  ipcMain.handle('hardware:readDistance', () => connection.readDistance());
  ipcMain.handle('hardware:disconnect', () => connection.disconnect());
  ipcMain.handle('hardware:probe', (_event, payload: { portPath: string }) =>
    connection.probe(payload.portPath));
  ipcMain.handle('hardware:autoDetect', () => connection.autoDetect());
  ipcMain.handle('hardware:executionStatus', () => executionLock());
  ipcMain.handle('hardware:execute', (_event, payload: { portPath?: string; angle?: number; confirm?: boolean }) =>
    executeRealAngle(payload));
}
