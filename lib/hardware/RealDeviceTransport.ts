import type { TransportFrame, TransportResponse } from './types';

/**
 * Transport boundary between the host runtime and a real physical device.
 *
 * Implementations must be honest about connectivity:
 * - send() MUST reject or return a failed response when not connected;
 *   it must never pretend a signal was delivered.
 */
export interface RealDeviceTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  /**
   * Send one frame and wait for the matching response.
   * Throws TransportOfflineError when the transport is not connected.
   */
  send(frame: TransportFrame): Promise<TransportResponse>;
}

export class TransportOfflineError extends Error {
  constructor(message = 'hardware offline') {
    super(message);
    this.name = 'TransportOfflineError';
    // Required for instanceof to work when compiled to ES5.
    Object.setPrototypeOf(this, TransportOfflineError.prototype);
  }
}
