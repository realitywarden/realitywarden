import { createHash } from 'node:crypto';
import path from 'node:path';
import { ReadableStream, WritableStream } from 'node:stream/web';
import { SerialPort } from 'serialport';

interface WebSerialOpenOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
}

interface WebSerialSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
}

/**
 * Shape adapter only: esptool-js still owns reset sequencing, SLIP, chip
 * detection, flash writes, verification, and hard reset. No protocol logic is
 * reproduced in Electron.
 */
class NodeWebSerialPort {
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;
  private port: SerialPort | null = null;
  private readableController: ReadableStreamDefaultController<Uint8Array> | null = null;
  private dtr = false;
  private rts = false;

  constructor(private readonly portPath: string) {}

  getInfo() {
    return {};
  }

  async open(options: WebSerialOpenOptions) {
    if (this.port?.isOpen) throw new Error('serial port is already open');
    const port = new SerialPort({
      path: this.portPath,
      baudRate: options.baudRate,
      dataBits: options.dataBits ?? 8,
      stopBits: options.stopBits ?? 1,
      parity: options.parity ?? 'none',
      autoOpen: false
    });
    this.port = port;
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.readableController = controller;
        port.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        port.on('error', (error) => controller.error(error));
        port.on('close', () => {
          try { controller.close(); } catch { /* already closed or errored */ }
        });
      },
      cancel: () => undefined
    });
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => new Promise<void>((resolve, reject) => {
        port.write(Buffer.from(chunk), (writeError) => {
          if (writeError) {
            reject(writeError);
            return;
          }
          port.drain((drainError) => (drainError ? reject(drainError) : resolve()));
        });
      }),
      close: () => new Promise<void>((resolve, reject) => {
        port.drain((error) => (error ? reject(error) : resolve()));
      })
    });
    await new Promise<void>((resolve, reject) => {
      port.open((error) => (error ? reject(error) : resolve()));
    });
  }

  async setSignals(signals: WebSerialSignals) {
    if (typeof signals.dataTerminalReady === 'boolean') this.dtr = signals.dataTerminalReady;
    if (typeof signals.requestToSend === 'boolean') this.rts = signals.requestToSend;
    const port = this.port;
    if (!port?.isOpen) throw new Error('serial port is not open');
    await new Promise<void>((resolve, reject) => {
      port.set({ dtr: this.dtr, rts: this.rts }, (error) => (error ? reject(error) : resolve()));
    });
  }

  async close() {
    const port = this.port;
    this.port = null;
    if (port?.isOpen) {
      await new Promise<void>((resolve, reject) => {
        port.close((error) => (error ? reject(error) : resolve()));
      });
    }
    this.readableController = null;
    this.readable = null;
    this.writable = null;
  }
}

interface EsptoolModule {
  Transport: new (device: unknown, tracing?: boolean) => {
    disconnect(): Promise<void>;
  };
  ESPLoader: new (options: {
    transport: unknown;
    baudrate: number;
    terminal: { clean(): void; write(data: string): void; writeLine(data: string): void };
    debugLogging: boolean;
  }) => {
    main(): Promise<string>;
    writeFlash(options: {
      fileArray: Array<{ data: Uint8Array; address: number }>;
      flashMode: 'keep';
      flashFreq: 'keep';
      flashSize: 'keep';
      eraseAll: false;
      compress: true;
      calculateMD5Hash(image: Uint8Array): string;
    }): Promise<void>;
    after(mode: 'hard_reset'): Promise<void>;
  };
}

export async function flashWithEsptoolJs(input: {
  runtimeRoot: string;
  portPath: string;
  bytes: Uint8Array;
  address: number;
}) {
  // scripts/build-electron.cjs packages the official browser ESM as CJS for
  // Electron. The protocol implementation remains the esptool-js dependency.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const esptool = require(path.join(input.runtimeRoot, 'esptool-js.cjs')) as EsptoolModule;
  const device = new NodeWebSerialPort(input.portPath);
  const transport = new esptool.Transport(device, false);
  const messages: string[] = [];
  const terminal = {
    clean: () => { messages.length = 0; },
    write: (data: string) => { if (data.trim()) messages.push(data.trim()); },
    writeLine: (data: string) => { if (data.trim()) messages.push(data.trim()); }
  };
  const loader = new esptool.ESPLoader({ transport, baudrate: 460800, terminal, debugLogging: false });
  try {
    const chip = await loader.main();
    if (!chip.toUpperCase().includes('ESP32-S3')) {
      throw new Error(`target chip rejected: reviewed image is ESP32-S3-only, detected ${chip}`);
    }
    await loader.writeFlash({
      fileArray: [{ data: input.bytes, address: input.address }],
      flashMode: 'keep',
      flashFreq: 'keep',
      flashSize: 'keep',
      eraseAll: false,
      compress: true,
      calculateMD5Hash: (image) => createHash('md5').update(image).digest('hex')
    });
    await loader.after('hard_reset');
    return { chip, messages: messages.slice(-8) };
  } finally {
    // A release failure is part of the operation result: do not hide it and
    // then pretend the port is ready for the reconnect/diagnose step.
    await transport.disconnect();
  }
}
