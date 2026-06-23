import { encode as msgpackEncode } from '@msgpack/msgpack';
import { deflateSync } from 'fflate';

export function defaultEncodePayload(payload) {
  const msgpackPacked = msgpackEncode(payload);
  return deflateSync(msgpackPacked);
}

/**
 * Transforms structured options into an aligned binary byte layout stream.
 */
export function encodeFrame({ type, nsp = '/', event = '', ackId = 0, payload = null }, serializers = { encodePayload: defaultEncodePayload }) {
  const encoder = new TextEncoder();
  const nspBytes = encoder.encode(nsp);
  const eventBytes = encoder.encode(event);

  let payloadBytes = new Uint8Array(0);
  if (payload !== null && payload !== undefined) {
    payloadBytes = serializers.encodePayload(payload);
  }

  // Allocation Matrix Calculation
  const frameSize = 1 + 1 + nspBytes.length + 1 + eventBytes.length + 4 + payloadBytes.length;
  const buffer = new Uint8Array(frameSize);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let offset = 0;

  // 1. Frame Type Assignment
  buffer[offset] = type; 
  offset += 1;

  // 2. Namespace Layout Allocation
  buffer[offset] = nspBytes.length; 
  offset += 1;
  buffer.set(nspBytes, offset); 
  offset += nspBytes.length;

  // 3. Event Signature Layout Allocation
  buffer[offset] = eventBytes.length; 
  offset += 1;
  buffer.set(eventBytes, offset); 
  offset += eventBytes.length;

  // 4. Correlation ID Allocation
  view.setUint32(offset, ackId, false); 
  offset += 4;

  // 5. Appending Data Payload Stream
  if (payloadBytes.length > 0) {
    buffer.set(payloadBytes, offset);
  }

  return buffer;
}
