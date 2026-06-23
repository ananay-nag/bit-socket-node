import test from 'node:test';
import assert from 'node:assert';
import { BitSocketServer } from '../src/server/index.js';
import { BitSocketClient } from '../src/client/index.js';
import { Schema } from '../src/protocol/index.js';
import WebSocket from 'ws';

global.WebSocket = WebSocket;

test('Middleware - should run connection middleware and allow transition', async () => {
  console.log('starting test 1');
  const io = new BitSocketServer({ port: 5010 });
  
  let rejected = false;
  io.of('/').use((socket, next) => {
    console.log('server mw called');
    rejected = true;
    next(new Error("Unauthorized"));
  });

  return new Promise((resolve) => {
    const client = new BitSocketClient('ws://localhost:5010', { autoReconnect: false });
    
    client.on('disconnect', () => {
      console.log('client disconnect triggered');
      assert.strictEqual(rejected, true);
      io.httpServer.close();
      resolve();
    });
    
    client.on('error', (err) => {
       console.log('client error', err);
    });
  });
});

test('Middleware - should run event-level middleware', async () => {
  const io = new BitSocketServer({ port: 0 }); 
  const port = io.httpServer.address().port;
  
  return new Promise((resolve, reject) => {
    try {
      io.of('/').on('connection', (socket) => {
        socket.use((packet, next) => {
           if (packet[0] === 'test') {
              packet[1].modified = true;
           }
           if (packet[0] === 'block_me') {
              return next(new Error("Blocked"));
           }
           next();
        });

        socket.on('test', (payload, ack) => {
          assert.strictEqual(payload.modified, true);
          ack({ ok: true });
        });

        socket.on('block_me', () => {
          assert.fail("Event should have been blocked");
        });
      });

      const client = new BitSocketClient(`ws://localhost:${port}`);
      
      client.on('connect', () => {
        client.emit('test', { hello: 'world' }, (res) => {
          assert.strictEqual(res.ok, true);
          
          client.emit('block_me', {}, () => {
            // Unused
          });
          
          setTimeout(() => {
             io.httpServer.close();
             client.close();
             resolve();
          }, 100);
        });
      });
      
      client.on('error', (err) => {
         // Should not hit general error
      });
    } catch(err) {
      reject(err);
    }
  });
});
