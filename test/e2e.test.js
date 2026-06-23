import test from 'node:test';
import assert from 'node:assert';
import { BitSocketServer } from '../src/server/index.js';
import { BitSocketClient } from '../src/client/index.js';
import WebSocket from 'ws';

// Polyfill global WebSocket for node execution in client
global.WebSocket = WebSocket;

test('E2E - Server and Client should connect and exchange messages', async (t) => {
  const io = new BitSocketServer({ port: 5001 });
  
  let resolveServerReceived;
  const serverReceivedPromise = new Promise(resolve => resolveServerReceived = resolve);
  
  io.of('/').on('connection', (socket) => {
    socket.on('ping', (data, ack) => {
      assert.strictEqual(data.msg, 'hello server');
      if (ack) ack({ status: 'ok' });
      resolveServerReceived();
    });
  });

  const client = new BitSocketClient('ws://localhost:5001', { nsp: '/' });
  
  let resolveClientAck;
  const clientAckPromise = new Promise(resolve => resolveClientAck = resolve);
  
  client.on('connect', () => {
    client.emit('ping', { msg: 'hello server' }, (res) => {
      assert.strictEqual(res.status, 'ok');
      resolveClientAck();
    });
  });

  await Promise.all([serverReceivedPromise, clientAckPromise]);
  
  client.close();
  io.httpServer.close();
});
