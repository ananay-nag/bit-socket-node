import { decode as msgpackDecode } from '@msgpack/msgpack';
import { inflateSync } from 'fflate';

export function defaultDecodePayload(buffer) {
  const inflatedData = inflateSync(buffer);
  return msgpackDecode(inflatedData);
}

/**
 * Parses raw transport wire memory blocks back into execution options.
 */
export function decodeFrame(rawBuffer, serializers = { decodePayload: defaultDecodePayload }) {
  const view = new Uint8Array(rawBuffer);
  const dataView = new DataView(view.buffer, view.byteOffset, view.byteLength);
  const decoder = new TextDecoder();

  let offset = 0;

  const type = view[offset]; 
  offset += 1;

  const nspLen = view[offset]; 
  offset += 1;
  const nsp = decoder.decode(view.subarray(offset, offset + nspLen)); 
  offset += nspLen;

  const eventLen = view[offset]; 
  offset += 1;
  const event = decoder.decode(view.subarray(offset, offset + eventLen)); 
  offset += eventLen;

  const ackId = dataView.getUint32(offset, false); 
  offset += 4;

  let payload = null;
  const remainingPayloadBytes = view.subarray(offset);
  if (remainingPayloadBytes.length > 0) {
    if (typeof serializers.decodePayloadWithEvent === 'function') {
      payload = serializers.decodePayloadWithEvent(remainingPayloadBytes, event, nsp);
    } else {
      payload = serializers.decodePayload(remainingPayloadBytes);
    }
  }

  return { type, nsp, event, ackId, payload };
}
