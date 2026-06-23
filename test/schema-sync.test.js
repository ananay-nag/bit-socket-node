import test from 'node:test';
import assert from 'node:assert';
import { BitSocketServer } from '../src/server/index.js';
import { BitSocketClient } from '../src/client/index.js';
import { Schema } from '../src/protocol/index.js';
import WebSocket from 'ws';

global.WebSocket = WebSocket;

test('E2E - Client should automatically sync schemas from server during handshake', async () => {
  return new Promise((resolve, reject) => {
    // 1. Setup Server
    const io = new BitSocketServer({ port: 5006 });
    
    // 2. Define schema ON SERVER ONLY
    const syncSchema = new Schema('SYNC_TEST', {
      userId: 'uint32',
      profileName: 'string',
      active: 'boolean'
    });
    
    io.of('/').schema(syncSchema);

    io.of('/').on('connection', (socket) => {
      // 4. Server emits payload using the schema (highly compressed)
      socket.emit('SYNC_TEST', {
        userId: 98765,
        profileName: 'AutoSync',
        active: true
      });
    });

    const url = `ws://localhost:5006`;
    
    // 3. Client connects (NO manual schema defined)
    const client = new BitSocketClient(url);
    
    client.on('connect', () => {
      try {
        // 5. Assert the client downloaded and registered the schema natively
        assert.ok(client.schemas.root['SYNC_TEST'], "Client should have auto-registered the schema");
        assert.deepStrictEqual(client.schemas.root['SYNC_TEST'].definition, syncSchema.definition);
      } catch (err) {
        reject(err);
      }
    });

    client.on('SYNC_TEST', (payload) => {
      // 6. Assert the payload was decoded correctly via the auto-synced schema
      try {
        assert.strictEqual(payload.userId, 98765);
        assert.strictEqual(payload.profileName, 'AutoSync');
        assert.strictEqual(payload.active, true);
        
        client.close();
        io.httpServer.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    setTimeout(() => {
      client.close();
      if (io.httpServer) io.httpServer.close();
      reject(new Error("Timeout waiting for schema sync and event emission"));
    }, 2000);
  });
});
