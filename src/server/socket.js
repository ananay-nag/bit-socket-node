import { BitSocketProtocol } from '../protocol/index.js';

export class ServerSocket {
  constructor(ws, server, nsp, handshakeData) {
    this.ws = ws;
    this.server = server;
    this.protocol = server.protocol;
    this.nsp = nsp;
    this.id = Math.random().toString(36).substring(2, 15) + BigInt(Date.now()).toString(36);
    this.rooms = new Set([this.id]); // Automatically join socket ID room
    this.listeners = {};
    this.middlewares = [];
    this.handshake = handshakeData;

    this.initTransport();
  }

  initTransport() {
    this.ws.on('message', (buffer) => {
      try {
        // Fast peek to ignore frames intended for other namespaces multiplexed on this websocket
        const view = new Uint8Array(buffer);
        if (view.length < 2) return;
        const nspLen = view[1];
        const incomingNsp = new TextDecoder().decode(view.subarray(2, 2 + nspLen));
        if (incomingNsp !== this.nsp) return;

        const nspObj = this.server.namespaces[this.nsp];
        const decoderContext = {
          decodePayloadWithEvent: (buf, event) => {
            const schema = nspObj && nspObj.schemas[event];
            return schema ? schema.decodePayload(buf) : this.protocol.decodePayload(buf);
          }
        };
        const frame = this.protocol.decodeFrame(buffer, decoderContext);
        if (frame.nsp !== this.nsp) return; // Strict isolation check

        switch (frame.type) {
          case this.protocol.FRAME_EVENT:
            this.processEvent(frame);
            break;
          case this.protocol.FRAME_JOIN:
            this.rooms.add(frame.payload.room);
            break;
          case this.protocol.FRAME_LEAVE:
            this.rooms.delete(frame.payload.room);
            break;
          case this.protocol.FRAME_PING:
            this.ws.send(this.protocol.encodeFrame({ type: this.protocol.FRAME_PONG, nsp: this.nsp }));
            break;
        }
      } catch (err) {
        console.error(`[BitSocket Error] Server Socket Parsing Core Failure [ID: ${this.id}]:`, err);
      }
    });

    this.ws.on('close', () => {
      this.server._disconnectClient(this);
    });
  }

  async processEvent(frame) {
    const packet = [frame.event, frame.payload];
    
    let index = 0;
    const run = async () => {
      if (index < this.middlewares.length) {
        try {
          await this.middlewares[index](packet, (err) => {
            if (err) {
              if (frame.ackId > 0) {
                const ackFrame = this.protocol.encodeFrame({
                  type: this.protocol.FRAME_ACK,
                  nsp: this.nsp,
                  event: 'error',
                  ackId: frame.ackId,
                  payload: { message: err.message || 'Middleware rejected event' }
                });
                if (this.ws.readyState === 1) this.ws.send(ackFrame);
              }
              return;
            }
            index++;
            run();
          });
        } catch (error) {
          // Unhandled exception halts pipeline
        }
      } else {
        const finalEvent = packet[0];
        const finalPayload = packet[1];

        if (this.listeners[finalEvent]) {
          const ack = frame.ackId > 0 ? (responsePayload) => {
            const ackFrame = this.protocol.encodeFrame({
              type: this.protocol.FRAME_ACK,
              nsp: this.nsp,
              event: finalEvent,
              ackId: frame.ackId,
              payload: responsePayload
            });
            if (this.ws.readyState === 1) this.ws.send(ackFrame);
          } : null;

          this.listeners[finalEvent](finalPayload, ack);
        }
      }
    };
    await run();
  }

  use(fn) {
    this.middlewares.push(fn);
    return this;
  }

  on(eventOrSchema, callback) {
    const event = typeof eventOrSchema === 'object' && eventOrSchema.schemaName ? eventOrSchema.schemaName : eventOrSchema;
    this.listeners[event] = callback;
  }

  emit(eventOrSchema, payload) {
    const event = typeof eventOrSchema === 'object' && eventOrSchema.schemaName ? eventOrSchema.schemaName : eventOrSchema;
    const nspObj = this.server.namespaces[this.nsp];
    let serializers = this.protocol;
    if (nspObj && nspObj.schemas[event]) {
      serializers = {
        encodePayload: (p) => nspObj.schemas[event].encodePayload(p)
      };
    }

    const buffer = this.protocol.encodeFrame({
      type: this.protocol.FRAME_EVENT,
      nsp: this.nsp,
      event,
      payload
    }, serializers);
    if (this.ws.readyState === 1) this.ws.send(buffer);
  }

  get broadcast() {
    const nspObj = this.server.namespaces[this.nsp];
    return {
      emit: (event, payload) => nspObj.emit(event, payload, this.id),
      to: (room) => ({
        emit: (event, payload) => nspObj.to(room).emit(event, payload, this.id)
      })
    };
  }

  to(room) {
    return this.broadcast.to(room);
  }

  join(room) {
    this.rooms.add(room);
  }

  leave(room) {
    this.rooms.delete(room);
  }
}
