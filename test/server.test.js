import test from 'node:test';
import assert from 'node:assert';
import { BitSocketServer } from '../src/server/index.js';
import { createServer } from 'http';

test('BitSocketServer - should initialize successfully', () => {
  const io = new BitSocketServer({ port: 0 }); // Port 0 for random port
  assert.ok(io);
  assert.ok(io.namespaces['/']);
  io.httpServer.close();
});

test('BitSocketServer - should throw error if no port or server is provided', () => {
  assert.throws(() => {
    new BitSocketServer();
  }, /Define a valid port configuration target or attach a target Server Instance/);
});

test('BitSocketServer - should support passing http server', () => {
  const server = createServer();
  const io = new BitSocketServer({ server });
  assert.ok(io);
  assert.ok(io.httpServer === server);
  server.close();
});
