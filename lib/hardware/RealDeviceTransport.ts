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
}

export class TransportOfflineError extends Error {
  constructor(message = 'hardware offline') {
    super(message);
    this.name = 'TransportOfflineError';
    // Required for instanceof to work when compiled to ES5.
    Object.setPrototypeOf(this, TransportOfflineError.prototype);
  }
}
