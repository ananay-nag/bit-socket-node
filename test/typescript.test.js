import test from 'node:test';
import assert from 'node:assert';
import { BitSocketServer } from '../src/server/index.js';
import { Schema } from '../src/protocol/index.js';
import fs from 'fs';
import path from 'path';

test('TypeScript - should generate correct definitions', () => {
  const io = new BitSocketServer({ port: 0 });

  const complexSchema = new Schema('COMPLEX_EVENT', {
    id: 'uint32',
    name: 'string',
    isActive: 'boolean',
    metadata: {
      tags: ['string'],
      score: 'float64'
    },
    raw: 'bytes'
  });

  io.of('/user').schema(complexSchema);

  const tsString = io.generateTypeScriptDefinitions();

  assert.ok(tsString.includes('export namespace BitSocketSchemas'));
  assert.ok(tsString.includes('export interface UserSchemas'));
  assert.ok(tsString.includes('COMPLEX_EVENT: {'));
  assert.ok(tsString.includes('id: number;'));
  assert.ok(tsString.includes('name: string;'));
  assert.ok(tsString.includes('isActive: boolean;'));
  assert.ok(tsString.includes('tags: Array<string>;'));
  assert.ok(tsString.includes('score: number;'));
  assert.ok(tsString.includes('raw: Uint8Array;'));

  io.close();
});
