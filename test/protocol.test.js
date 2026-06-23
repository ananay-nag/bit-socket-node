import test from 'node:test';
import assert from 'node:assert';
import { BitSocketProtocol } from '../src/protocol/index.js';

test('BitSocketProtocol - should encode and decode basic EVENT frame without payload', () => {
  const options = {
    type: BitSocketProtocol.FRAME_EVENT,
    nsp: '/test',
    event: 'hello',
    ackId: 0,
    payload: null
  };

  const encoded = BitSocketProtocol.encodeFrame(options);
  const decoded = BitSocketProtocol.decodeFrame(encoded);

  assert.strictEqual(decoded.type, options.type);
  assert.strictEqual(decoded.nsp, options.nsp);
  assert.strictEqual(decoded.event, options.event);
  assert.strictEqual(decoded.ackId, options.ackId);
  assert.strictEqual(decoded.payload, options.payload);
});

test('BitSocketProtocol - should encode and decode EVENT frame with JSON payload', () => {
  const payload = { user: 'test', id: 123 };
  const options = {
    type: BitSocketProtocol.FRAME_EVENT,
    nsp: '/',
    event: 'data',
    ackId: 42,
    payload
  };

  const encoded = BitSocketProtocol.encodeFrame(options);
  const decoded = BitSocketProtocol.decodeFrame(encoded);

  assert.strictEqual(decoded.type, options.type);
  assert.strictEqual(decoded.nsp, options.nsp);
  assert.strictEqual(decoded.event, options.event);
  assert.strictEqual(decoded.ackId, options.ackId);
  assert.deepStrictEqual(decoded.payload, options.payload);
});
