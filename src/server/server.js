import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fs from 'fs';
import { BitSocketProtocol } from '../protocol/index.js';
import { ServerSocket } from './socket.js';
import { Namespace } from './namespace.js';

export class BitSocketServer {
  constructor(config = {}) {
    this.protocol = config.protocol || BitSocketProtocol;
    this.port = config.port !== undefined ? config.port : null;
    this.useSchemas = config.useSchemas !== false;
    this.allowedOrigins = config.cors?.origin ? [].concat(config.cors.origin) : ['*'];
    this.namespaces = {};
    
    // Auto-instantiate core namespace target routing
    this.of('/');

    if (this.port !== null) {
      this.httpServer = createServer((req, res) => {
        res.writeHead(404);
        res.end();
      });
      this.wss = new WebSocketServer({ noServer: true });
      this.setupUpgradeHandler();
      this.httpServer.listen(this.port);
      console.log(`[BitSocket Core Server Engine Initialized on Port ${this.port}]`);
    } else if (config.server) {
      this.wss = new WebSocketServer({ noServer: true });
      this.httpServer = config.server;
      this.setupUpgradeHandler();
    } else {
      throw new Error("Initialization Parameter Fault: Define a valid port configuration target or attach a target Server Instance.");
    }

    this.initCoreTransport();
  }

  get schemas() {
    const agg = {};
    for (const nsp in this.namespaces) {
      const nspKey = nsp === '/' ? 'root' : nsp.replace(/^\//, '');
      agg[nspKey] = this.namespaces[nsp].schemas;
    }
    return agg;
  }

  of(name) {
    if (!this.namespaces[name]) {
      this.namespaces[name] = new Namespace(name, this);
    }
    return this.namespaces[name];
  }

  setupUpgradeHandler() {
    this.httpServer.on('upgrade', (request, socket, head) => {
      const origin = request.headers.origin;
      
      // Strict CORS Security Posture Validation
      if (this.allowedOrigins.length > 0 && !this.allowedOrigins.includes('*') && !this.allowedOrigins.includes(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    });
  }

  exportAllSchemas() {
    const payload = {};
    for (const nsp in this.namespaces) {
       const nspKey = nsp === '/' ? 'root' : nsp.replace(/^\//, '');
       payload[nspKey] = this.namespaces[nsp].exportSchemas();
    }
    return payload;
  }

  initCoreTransport() {
    this.wss.on('connection', (ws, request) => {
      ws.binaryType = 'arraybuffer';

      const handshakeData = {
        headers: request.headers,
        url: request.url,
        time: new Date().toISOString()
      };

      const baseSocket = new ServerSocket(ws, this, '/', handshakeData);
      const rootNamespace = this.namespaces['/'];
      
      rootNamespace._runMiddlewares(baseSocket, (passed) => {
        if (passed) {
          rootNamespace.sockets.add(baseSocket);
          
          // Send ALL cluster schemas in the root payload explicitly
          const connectPayload = this.useSchemas ? this.exportAllSchemas() : null;
          ws.send(this.protocol.encodeFrame({ type: this.protocol.FRAME_CONNECT, nsp: '/', payload: connectPayload }));

          rootNamespace.connectionListeners.forEach(listener => listener(baseSocket));
        }
      });

      // Handle raw incoming binary pipeline frame analysis
      ws.on('message', (buffer) => {
        try {
          const view = new Uint8Array(buffer);
          // Fast peek: the global router only cares about FRAME_CONNECT (type 3)
          if (view.length === 0 || view[0] !== this.protocol.FRAME_CONNECT) return;
          
          const frame = this.protocol.decodeFrame(buffer);
          console.log("[Node.js Server.js] Handled FRAME_CONNECT from root WS for nsp:", frame.nsp);
          if (frame.type === this.protocol.FRAME_CONNECT && frame.nsp !== '/') {
            const targetNsp = this.namespaces[frame.nsp];
            if (!targetNsp) {
              const errorFrame = this.protocol.encodeFrame({
                type: this.protocol.FRAME_ACK,
                nsp: frame.nsp,
                event: 'error',
                payload: { message: `Requested namespace '${frame.nsp}' does not exist on cluster.` }
              });
              ws.send(errorFrame);
              return;
            }

            const nspSocket = new ServerSocket(ws, this, frame.nsp, handshakeData);
            targetNsp._runMiddlewares(nspSocket, (passed) => {
              if (passed) {
                targetNsp.sockets.add(nspSocket);
                
                // Confirm connection status to client with schema payload
                const connectPayload = this.useSchemas ? targetNsp.exportSchemas() : null;
                ws.send(this.protocol.encodeFrame({ type: this.protocol.FRAME_CONNECT, nsp: frame.nsp, payload: connectPayload }));

                targetNsp.connectionListeners.forEach(listener => listener(nspSocket));
              }
            });
          }
        } catch (err) {
          // Failure handled cleanly inside internal connection handler pipeline scope 
        }
      });
    });
  }

  use(fn) {
    const rootNsp = this.namespaces['/'];
    if (rootNsp) return rootNsp.use(fn);
    return this;
  }

  on(event, callback) {
    const rootNsp = this.namespaces['/'];
    if (rootNsp) return rootNsp.on(event, callback);
    return this;
  }

  emit(event, payload) {
    const rootNsp = this.namespaces['/'];
    if (rootNsp) rootNsp.emit(event, payload);
  }

  to(room, targetNamespace = '/') {
    const nsp = this.namespaces[targetNamespace];
    return nsp ? nsp.to(room) : { emit: () => {} };
  }

  _disconnectClient(serverSocket) {
    const nsp = this.namespaces[serverSocket.nsp];
    if (nsp) {
      nsp.sockets.delete(serverSocket);
    }
  }

  close() {
    if (this.wss) {
      for (const client of this.wss.clients) {
        client.terminate();
      }
      this.wss.close();
    }
    if (this.httpServer) {
      this.httpServer.close();
    }
  }

  static _mapSchemaTypeToTS(type, indentLevel = 4) {
    const pad = ' '.repeat(indentLevel);
    if (typeof type === 'string') {
      switch (type) {
        case 'uint8':
        case 'uint16':
        case 'uint32':
        case 'int32':
        case 'float64':
          return 'number';
        case 'boolean':
          return 'boolean';
        case 'string':
          return 'string';
        case 'bytes':
          return 'Uint8Array';
        case 'object':
          return 'Record<string, any>';
        case 'array':
          return 'any[]';
        case 'any':
          return 'any';
        default:
          return 'any';
      }
    } else if (Array.isArray(type)) {
      const elType = BitSocketServer._mapSchemaTypeToTS(type[0], indentLevel);
      return `Array<${elType}>`;
    } else if (typeof type === 'object' && type !== null) {
      let str = '{\n';
      const keys = Object.keys(type);
      for (const key of keys) {
        const valType = BitSocketServer._mapSchemaTypeToTS(type[key], indentLevel + 2);
        str += `${pad}  ${key}: ${valType};\n`;
      }
      str += `${pad}}`;
      return str;
    }
    return 'any';
  }

  generateTypeScriptDefinitions() {
    let output = `// Auto-generated BitSocket Types\n// Do not edit directly\n\n`;
    output += `export namespace BitSocketSchemas {\n`;
    
    for (const [nspName, nspObj] of Object.entries(this.namespaces)) {
      const interfaceName = nspName === '/' 
        ? 'RootSchemas' 
        : nspName.replace(/^\//, '').replace(/^./, (c) => c.toUpperCase()) + 'Schemas';
      
      output += `  export interface ${interfaceName} {\n`;
      
      for (const [eventName, schema] of Object.entries(nspObj.schemas)) {
        if (!/^[a-zA-Z0-9_]+$/.test(eventName)) continue;
        const tsType = BitSocketServer._mapSchemaTypeToTS(schema.definition, 4);
        output += `    ${eventName}: ${tsType};\n`;
      }
      output += `  }\n`;
    }
    output += `}\n`;
    return output;
  }

  exportTypeScript(filePath) {
    const tsCode = this.generateTypeScriptDefinitions();
    fs.writeFileSync(filePath, tsCode, 'utf8');
    return tsCode;
  }
}
