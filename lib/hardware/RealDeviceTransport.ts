import type { ActuationTicket } from './internal/actuation';
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
   * Send one READ-ONLY frame and wait for the matching response.
   * Throws TransportOfflineError when the transport is not connected.
   * MUST refuse actuation commands (audit 1.1): an actuation frame may only
   * travel via sendActuation(), which requires the gate-private ticket.
   */
  send(frame: TransportFrame): Promise<TransportResponse>;
  /**
   * Send one ACTUATION frame. Rejects unless `ticket` is the gate-private
   * ACTUATION_TICKET — this is what makes "blocked => zero frames" structural
   * rather than conventional: holding a transport reference is not enough to
   * actuate.
   */
  sendActuation(frame: TransportFrame, ticket: ActuationTicket): Promise<TransportResponse>;
  /**
   * Most recent protocol-level error (malformed line, unmatched id, oversized
   * input), if the transport tracks one. Surfaced into failure details so a
   * timeout caused by garbled data is distinguishable from silence
   * (audit 3.1: degradations must be visible, not just honest).
   */
  getLastProtocolError?(): string | null;
}

export class TransportOfflineError extends Error {
  constructor(message = 'hardware offline') {
    super(message);
    this.name = 'TransportOfflineError';
    // Required for instanceof to work when compiled to ES5.
    Object.setPrototypeOf(this, TransportOfflineError.prototype);
  }
}

/**
 * The host rejected a frame before writing any bytes to the physical port.
 * Callers use this distinction to keep `signalSent` honest: malformed,
 * duplicate, retired, or oversized frames are failures, but they are known to
 * have emitted zero hardware signal.
 */
export class TransportFrameRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransportFrameRejectedError';
    Object.setPrototypeOf(this, TransportFrameRejectedError.prototype);
  }
}
