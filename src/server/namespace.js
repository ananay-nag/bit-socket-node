import { BitSocketProtocol } from '../protocol/index.js';

export class Namespace {
  constructor(name, server) {
    this.name = name;
    this.server = server;
    this.protocol = server.protocol;
    this.sockets = new Set();
    this.middlewares = [];
    this.connectionListeners = [];
    this.schemas = {};
  }

  schema(schemaObjOrArray) {
    if (Array.isArray(schemaObjOrArray)) {
      schemaObjOrArray.forEach(s => this.schemas[s.schemaName] = s);
    } else {
      this.schemas[schemaObjOrArray.schemaName] = schemaObjOrArray;
    }
    return this;
  }

  exportSchemas() {
    const defs = {};
    for (const event in this.schemas) {
      defs[event] = this.schemas[event].definition;
    }
    return defs;
  }

  use(fn) {
    this.middlewares.push(fn);
    return this;
  }

  emit(eventOrSchema, payload, excludeSocketId = null) {
    const event = typeof eventOrSchema === 'object' && eventOrSchema.schemaName ? eventOrSchema.schemaName : eventOrSchema;
    let serializers = this.server.protocol;
    if (this.schemas[event]) {
      serializers = { encodePayload: (p) => this.schemas[event].encodePayload(p) };
    }
    const frameBuffer = this.server.protocol.encodeFrame({
      type: this.server.protocol.FRAME_EVENT,
      nsp: this.name,
      event,
      payload
    }, serializers);

    this.sockets.forEach(socket => {
      if (socket.id !== excludeSocketId && socket.ws.readyState === 1) {
        socket.ws.send(frameBuffer);
      }
    });
  }

  to(room) {
    return {
      emit: (eventOrSchema, payload, excludeSocketId = null) => {
        const event = typeof eventOrSchema === 'object' && eventOrSchema.schemaName ? eventOrSchema.schemaName : eventOrSchema;
        let serializers = this.server.protocol;
        if (this.schemas[event]) {
          serializers = { encodePayload: (p) => this.schemas[event].encodePayload(p) };
        }
        const frameBuffer = this.server.protocol.encodeFrame({
          type: this.server.protocol.FRAME_EVENT,
          nsp: this.name,
          event,
          payload
        }, serializers);

        this.sockets.forEach(socket => {
          if (socket.rooms.has(room) && socket.id !== excludeSocketId && socket.ws.readyState === 1) {
            socket.ws.send(frameBuffer);
          }
        });
      }
    };
  }

  on(eventOrSchema, callback) {
    const event = typeof eventOrSchema === 'object' && eventOrSchema.schemaName ? eventOrSchema.schemaName : eventOrSchema;
    if (event === 'connection') {
      this.connectionListeners.push(callback);
    }
    return this;
  }

  async _runMiddlewares(socket, callback) {
    let index = 0;
    const run = async () => {
      if (index < this.middlewares.length) {
        try {
          await this.middlewares[index](socket, (err) => {
            if (err) {
              const errorFrame = this.protocol.encodeFrame({
                type: this.protocol.FRAME_ACK,
                nsp: this.name,
                event: 'error',
                payload: { message: err.message || 'Unauthorized Namespace Transition' }
              });
              socket.ws.send(errorFrame);
              socket.ws.close();
              callback(false);
            } else {
              index++;
              run();
            }
          });
        } catch (error) {
          callback(false);
        }
      } else {
        callback(true);
      }
    };
    await run();
  }
}
