import test from 'node:test';
import assert from 'node:assert';
import { Schema } from '../src/protocol/index.js';

test('Schema - should encode and decode basic types without keys', () => {
  const userSchema = new Schema('USER_TEST', {
    id: 'uint32',
    name: 'string',
    isActive: 'boolean'
  });

  const payload = {
    id: 1045,
    name: "Ana",
    isActive: true
  };

  const buffer = userSchema.encodePayload(payload);
  
  // Size: 4 (uint32) + 4 (string length) + 3 ("Ana") + 1 (boolean) = 12 bytes
  assert.strictEqual(buffer.byteLength, 12);

  const decoded = userSchema.decodePayload(buffer);

  assert.deepStrictEqual(decoded, payload);
});

test('Schema - should handle empty strings and bytes', () => {
  const edgeSchema = new Schema('EDGE_TEST', {
    buf: 'bytes',
    text: 'string'
  });

  const payload = {
    buf: new Uint8Array(0),
    text: ""
  };

  const buffer = edgeSchema.encodePayload(payload);
  // 4 (bytes length) + 0 + 4 (string length) + 0 = 8 bytes
  assert.strictEqual(buffer.byteLength, 8);

  const decoded = edgeSchema.decodePayload(buffer);
  assert.strictEqual(decoded.text, "");
  assert.strictEqual(decoded.buf.byteLength, 0);
});

test('Schema - should handle all supported numeric types', () => {
  const numSchema = new Schema('NUM_TEST', {
    u8: 'uint8',
    u16: 'uint16',
    u32: 'uint32',
    i32: 'int32',
    f64: 'float64'
  });

  const payload = {
    u8: 255,
    u16: 65535,
    u32: 4294967295,
    i32: -2147483648,
    f64: 3.14159265359
  };

  const buffer = numSchema.encodePayload(payload);
  // 1 + 2 + 4 + 4 + 8 = 19 bytes
  assert.strictEqual(buffer.byteLength, 19);

  const decoded = numSchema.decodePayload(buffer);
  assert.deepStrictEqual(decoded, payload);
});

test('Schema - should handle strict nested objects', () => {
  const nestedSchema = new Schema('NESTED_TEST', {
    id: 'uint32',
    profile: {
      age: 'uint8',
      isActive: 'boolean'
    }
  });

  const payload = {
    id: 999,
    profile: {
      age: 25,
      isActive: true
    }
  };

  const buffer = nestedSchema.encodePayload(payload);
  // id(4) + age(1) + isActive(1) = 6 bytes
  assert.strictEqual(buffer.byteLength, 6);

  const decoded = nestedSchema.decodePayload(buffer);
  assert.deepStrictEqual(decoded, payload);
});

test('Schema - should handle strict arrays', () => {
  const arrSchema = new Schema('ARR_TEST', {
    tags: ['string'],
    matrix: [['uint8']]
  });

  const payload = {
    tags: ["alpha", "beta"],
    matrix: [[1, 2], [3, 4]]
  };

  const buffer = arrSchema.encodePayload(payload);
  const decoded = arrSchema.decodePayload(buffer);
  assert.deepStrictEqual(decoded, payload);
});

test('Schema - should handle dynamic msgpack fallbacks', () => {
  const dynSchema = new Schema('DYN_TEST', {
    metadata: 'object',
    list: 'array'
  });

  const payload = {
    metadata: { arbitrary: "data", val: 42 },
    list: [1, "two", { three: 3 }]
  };

  const buffer = dynSchema.encodePayload(payload);
  const decoded = dynSchema.decodePayload(buffer);
  assert.deepStrictEqual(decoded, payload);
});
