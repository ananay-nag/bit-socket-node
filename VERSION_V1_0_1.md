# BitSocket (@ananay-nag/bit-socket-node) 
## Node.js Library Version & Features
## Version Information
- **Current Version**: `1.0.1`
- **Modules Exported**: ES Modules (esm) & CommonJS (cjs)
- **Target Platform**: Node.js >= 18

## Key Features

1. **Schema-Driven Binary Serialization**
   Eliminates JSON overhead by converting JS objects to strict positional binary layout `ArrayBuffers` based on pre-defined schemas.

2. **Schema Auto-Discovery & Handshake Sync**
   The client automatically downloads schemas registered by the server during connection handshakes.

3. **TypeScript Definition Export**
   A dedicated utility `io.exportTypeScript(outputFilePath)` that automatically parses server-registered schemas and writes ready-to-use TypeScript type definitions (`.d.ts`) for client-side type-safety.

4. **Connection Multiplexing (Namespaces)**
   Multiplexes isolated communication channels (e.g. `/`, `/chat`, `/admin`) over a single underlying TCP/WebSocket connection.

5. **Room Scoping & Broadcasting**
   Group clients into rooms with `socket.join(roomName)`, `socket.leave(roomName)` and broadcast with `io.to(roomName).emit(...)`.

6. **Handshake Authentication Middleware**
   Integrates connection handshake interceptors (`io.use((socket, next) => { ... })`) to validate query strings (`?token=...` or `?userId=...&password=...`).

## Example Run Methods

The library provides manual test scripts and examples inside the repository:

### 1. Run the Manual Server Example
To run the server example that binds to port `5000` with secured gateway, middleware, and schema-synced frames:
```bash
git clone https://github.com/ananay-nag/bit-socket-node.git
cd bit-socket-node
node examples/advanced/server/index.js
```

### 2. Run the Manual Client Example
To run the manual client that connects to the server and prints received schema-synced messages:
```bash
https://github.com/ananay-nag/bit-socket-node.git
cd bit-socket-node
node examples/advanced/client/index.js
```

### 3. Run the Test Suite
The library contains automated tests checking the protocol frames, schemas, E2E client-server flow, and packet logs:
```bash
npm install
npm test
```
