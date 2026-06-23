import { BitSocketProtocol, Schema } from '../protocol/index.js';

export class ClientNamespace {
  constructor(client, nsp) {
    this.client = client;
    this.nsp = nsp;
    this.listeners = {};

    // Automatically register root tracking for schemas
    if (!this.client.schemas) this.client.schemas = {};
    const nspKey = this.nsp === '/' ? 'root' : this.nsp.replace(/^\//, '');
    if (!this.client.schemas[nspKey]) this.client.schemas[nspKey] = {};
  }

  schema(schemaObjOrArray) {
    const nspKey = this.nsp === '/' ? 'root' : this.nsp.replace(/^\//, '');
    if (Array.isArray(schemaObjOrArray)) {
      schemaObjOrArray.forEach(s => this.client.schemas[nspKey][s.schemaName] = s);
    } else {
      this.client.schemas[nspKey][schemaObjOrArray.schemaName] = schemaObjOrArray;
    }
    return this;
  }

  on(eventOrSchema, callback) {
    const event = typeof eventOrSchema === 'object' && eventOrSchema.schemaName ? eventOrSchema.schemaName : eventOrSchema;
    this.listeners[event] = callback;
  }

  emit(event, payload, callback = null) {
    this.client._doEmit(event, payload, callback, this.nsp);
  }

  join(room) {
    this.client._doJoin(room, this.nsp);
  }

  leave(room) {
    this.client._doLeave(room, this.nsp);
  }

  close() {
    this.listeners = {};
    if (this.nsp === '/') {
      this.client.close();
    }
  }

  use(fn) {
    if (!this.middlewares) this.middlewares = [];
    this.middlewares.push(fn);
    return this;
  }

  async _triggerEvent(event, data) {
    if (this.middlewares && this.middlewares.length > 0) {
      const packet = [event, data];
      let index = 0;

      const run = async () => {
        if (index < this.middlewares.length) {
          try {
            await this.middlewares[index](packet, (err) => {
              if (err) return; // Halt on error
              index++;
              run();
            });
          } catch (err) {
            // Halt on unhandled exception
          }
        } else {
          if (this.listeners[packet[0]]) {
            this.listeners[packet[0]](packet[1]);
          }
        }
      };
      await run();
    } else {
      if (this.listeners[event]) {
        this.listeners[event](data);
      }
    }
  }
}

export class BitSocketClient {
  constructor(url, options = {}) {
    this.url = url;
    this.protocol = options.protocol || BitSocketProtocol;
    this.useSchemas = options.useSchemas !== false;
    this.autoReconnect = options.autoReconnect !== false;
    this.reconnectAttempts = 0;
    this.maxAttempts = options.maxAttempts || 15;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 7000;

    this.ackCallbacks = {};
    this.ackCounter = 1;
    this.pingIntervalTime = 20000;
    this.pongTimeoutTime = 8000;

    this.schemas = {};
    this.namespaces = {};

    this.nsp = options.nsp || '/';
    this.rootNamespace = new ClientNamespace(this, this.nsp);
    this.namespaces[this.nsp] = this.rootNamespace;

    // Expose root namespace methods directly on client instance
    this.on = this.rootNamespace.on.bind(this.rootNamespace);
    this.emit = this.rootNamespace.emit.bind(this.rootNamespace);
    this.join = this.rootNamespace.join.bind(this.rootNamespace);
    this.leave = this.rootNamespace.leave.bind(this.rootNamespace);
    this.schema = this.rootNamespace.schema.bind(this.rootNamespace);
    this.use = this.rootNamespace.use.bind(this.rootNamespace);

    this.connect();
  }

  of(nsp) {
    if (!this.namespaces[nsp]) {
      this.namespaces[nsp] = new ClientNamespace(this, nsp);
      if (this.ws && this.ws.readyState === 1 && nsp !== '/') {
        this.ws.send(this.protocol.encodeFrame({ type: this.protocol.FRAME_CONNECT, nsp }));
      }
    }
    return this.namespaces[nsp];
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log("WebSocket OPENED!");
      this.reconnectAttempts = 0;

      // Initialize channel routing for all active namespaces
      for (const nsp in this.namespaces) {
        if (nsp !== '/') {
          this.ws.send(this.protocol.encodeFrame({ type: this.protocol.FRAME_CONNECT, nsp }));
        }
      }
    };

    this.ws.onmessage = (messageEvent) => {
      try {
        let bufferData = messageEvent.data;
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(bufferData)) {
          bufferData = new Uint8Array(bufferData).buffer;
        }

        const decoderContext = {
          decodePayloadWithEvent: (buf, event, frameNsp) => {
            const nspKey = frameNsp === '/' ? 'root' : frameNsp.replace(/^\//, '');
            const schema = this.schemas[nspKey] && this.schemas[nspKey][event];
            return schema ? schema.decodePayload(buf) : this.protocol.decodePayload(buf);
          }
        };

        const frame = this.protocol.decodeFrame(bufferData, decoderContext);
        const targetNsp = this.namespaces[frame.nsp];

        // Drop frame if no multiplexed client namespace exists for it
        if (!targetNsp) return;

        switch (frame.type) {
          case this.protocol.FRAME_CONNECT:
            if (this.useSchemas && frame.payload) {
              if (frame.nsp === '/') {
                for (const nspKey in frame.payload) {
                  if (!this.schemas[nspKey]) this.schemas[nspKey] = {};
                  for (const eventName in frame.payload[nspKey]) {
                    const schema = new Schema(eventName, frame.payload[nspKey][eventName]);
                    this.schemas[nspKey][eventName] = schema;
                    
                    // Flatten so user can access directly via root.schemas.EVENT_NAME
                    this.schemas[eventName] = schema;
                  }
                }
              } else {
                const nspKey = frame.nsp.replace(/^\//, '');
                if (!this.schemas[nspKey]) this.schemas[nspKey] = {};
                for (const eventName in frame.payload) {
                  const schema = new Schema(eventName, frame.payload[eventName]);
                  this.schemas[nspKey][eventName] = schema;

                  // Flatten so user can access directly via root.schemas.EVENT_NAME
                  this.schemas[eventName] = schema;
                }
              }
            }
            targetNsp._triggerEvent('connect', null);
            if (frame.nsp === this.nsp) {
              this.setupHeartbeat(); // setup heartbeat for primary connection
            }
            break;
          case this.protocol.FRAME_EVENT:
            targetNsp._triggerEvent(frame.event, frame.payload);
            break;
          case this.protocol.FRAME_ACK:
            if (this.ackCallbacks[frame.ackId]) {
              this.ackCallbacks[frame.ackId](frame.payload);
              delete this.ackCallbacks[frame.ackId];
            }
            break;
          case this.protocol.FRAME_PONG:
            clearTimeout(this.pongTimeoutHandle);
            break;
        }
      } catch (err) {
        console.error("[BitSocket Client] Error parsing incoming transmission package frame:", err);
      }
    };

    this.ws.onclose = () => {
      this.cleanupState();
      for (const nsp in this.namespaces) {
        this.namespaces[nsp]._triggerEvent('disconnect', null);
      }

      if (this.autoReconnect && this.reconnectAttempts < this.maxAttempts) {
        this.executeReconnectionSchedule();
      }
    };

    this.ws.onerror = () => { };
  }

  setupHeartbeat() {
    clearInterval(this.pingIntervalHandle);
    this.pingIntervalHandle = setInterval(() => {
      if (this.ws.readyState === 1) {
        this.ws.send(this.protocol.encodeFrame({ type: this.protocol.FRAME_PING, nsp: '/' }));

        this.pongTimeoutHandle = setTimeout(() => {
          console.warn("[BitSocket Client] Ping-Pong Heartbeat Timeout detected. Restructuring channel link connection...");
          this.ws.close();
        }, this.pongTimeoutTime);
      }
    }, this.pingIntervalTime);
  }

  executeReconnectionSchedule() {
    this.reconnectAttempts++;
    const BackoffDelayCalculation = Math.min(
      this.baseDelay * Math.pow(1.5, this.reconnectAttempts) + Math.random() * 300,
      this.maxDelay
    );

    setTimeout(() => {
      for (const nsp in this.namespaces) {
        this.namespaces[nsp]._triggerEvent('reconnecting', this.reconnectAttempts);
      }
      this.connect();
    }, BackoffDelayCalculation);
  }

  _doEmit(eventOrSchema, payload, callback, targetNsp) {
    const event = typeof eventOrSchema === 'object' && eventOrSchema.schemaName ? eventOrSchema.schemaName : eventOrSchema;
    let trackingCorrelationToken = 0;
    if (callback) {
      trackingCorrelationToken = this.ackCounter++;
      this.ackCallbacks[trackingCorrelationToken] = callback;
    }

    const nspKey = targetNsp === '/' ? 'root' : targetNsp.replace(/^\//, '');
    let serializers = this.protocol;
    if (this.schemas[nspKey] && this.schemas[nspKey][event]) {
      serializers = {
        encodePayload: (p) => this.schemas[nspKey][event].encodePayload(p)
      };
    }

    const buffer = this.protocol.encodeFrame({
      type: this.protocol.FRAME_EVENT,
      nsp: targetNsp,
      event,
      ackId: trackingCorrelationToken,
      payload
    }, serializers);

    if (this.ws.readyState === 1) {
      this.ws.send(buffer);
    } else {
      console.error(`[BitSocket Client] Failed data delivery initialization: Pipeline currently in closed state window. [Event: ${event}]`);
    }
  }

  _doJoin(room, nsp) {
    const buffer = this.protocol.encodeFrame({ type: this.protocol.FRAME_JOIN, nsp, payload: { room } });
    if (this.ws.readyState === 1) this.ws.send(buffer);
  }

  _doLeave(room, nsp) {
    const buffer = this.protocol.encodeFrame({ type: this.protocol.FRAME_LEAVE, nsp, payload: { room } });
    if (this.ws.readyState === 1) this.ws.send(buffer);
  }

  cleanupState() {
    clearInterval(this.pingIntervalHandle);
    clearTimeout(this.pongTimeoutHandle);
  }

  close() {
    this.autoReconnect = false;
    this.ws.close();
  }
}
