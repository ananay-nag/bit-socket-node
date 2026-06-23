// ============================================================
//  bit-socket — Official TypeScript Declarations
//  Covers: Schema, Protocol, Server (Node.js), Client (Browser)
// ============================================================

// ─────────────────────────────────────────────────────────────
// Primitive Schema Field Types
// ─────────────────────────────────────────────────────────────

export type SchemaFieldType =
  | 'uint8'
  | 'uint16'
  | 'uint32'
  | 'int32'
  | 'float64'
  | 'boolean'
  | 'string'
  | 'bytes'
  | 'object'
  | 'array'
  | 'any';

/** Recursive schema definition — mirrors what you pass to `new Schema(name, { ... })` */
export type SchemaDefinition =
  | SchemaFieldType
  | SchemaDefinition[]
  | { [key: string]: SchemaDefinition };

// ─────────────────────────────────────────────────────────────
// Schema  (shared between server and client)
// ─────────────────────────────────────────────────────────────

export declare class Schema {
  constructor(name: string, definition: SchemaDefinition);
  /** Overload: name is inferred as 'unknown' when omitted */
  constructor(definition: SchemaDefinition);

  readonly schemaName: string;
  readonly definition: SchemaDefinition;

  encodePayload(payload: any): Uint8Array;
  decodePayload(buffer: ArrayBuffer | Uint8Array): any;
}

// ─────────────────────────────────────────────────────────────
// Protocol
// ─────────────────────────────────────────────────────────────

export interface FrameOptions {
  type:     number;
  nsp?:     string;
  event?:   string;
  ackId?:   number;
  payload?: any;
}

export interface BitSocketProtocolType {
  // Frame type constants
  readonly FRAME_CONNECT: 0x01;
  readonly FRAME_EVENT:   0x02;
  readonly FRAME_ACK:     0x03;
  readonly FRAME_PING:    0x04;
  readonly FRAME_PONG:    0x05;
  readonly FRAME_JOIN:    0x06;
  readonly FRAME_LEAVE:   0x07;

  encodePayload(payload: any): Uint8Array;
  decodePayload(buffer: ArrayBuffer | Uint8Array): any;
  encodeFrame(options: FrameOptions, customSerializers?: Partial<BitSocketProtocolType>): Uint8Array;
  decodeFrame(buffer: ArrayBuffer | Uint8Array, customSerializers?: any): any;
}

export declare const BitSocketProtocol: BitSocketProtocolType;

// ─────────────────────────────────────────────────────────────
// Server — Node.js only
// ─────────────────────────────────────────────────────────────

export interface HandshakeData {
  headers: Record<string, string | string[] | undefined>;
  url:     string;
  time:    string;
}

export declare class ServerSocket {
  readonly id:        string;
  readonly nsp:       string;
  readonly rooms:     Set<string>;
  /** Raw `ws` WebSocket instance */
  readonly ws:        any;
  readonly handshake: HandshakeData;
  readonly protocol:  BitSocketProtocolType;

  on(event: 'connection', callback: () => void): void;
  on(event: string | Schema, callback: (payload: any, ack?: (response: any) => void) => void): void;

  emit(event: string | Schema, payload: any): void;
  join(room: string): void;
  leave(room: string): void;
  use(fn: (packet: [string, any], next: (err?: Error) => void) => void): this;

  readonly broadcast: {
    emit(event: string | Schema, payload: any): void;
    to(room: string): { emit(event: string | Schema, payload: any): void };
  };

  to(room: string): { emit(event: string | Schema, payload: any): void };
}

export declare class Namespace {
  readonly name:    string;
  readonly schemas: Record<string, Schema>;
  readonly sockets: Set<ServerSocket>;

  schema(schemas: Schema | Schema[]): this;
  use(fn: (socket: ServerSocket, next: (err?: Error) => void) => void): this;

  on(event: 'connection', callback: (socket: ServerSocket) => void): this;
  on(event: string | Schema, callback: (payload: any) => void): this;

  emit(event: string | Schema, payload: any, excludeSocketId?: string | null): void;
  to(room: string): { emit(event: string | Schema, payload: any, excludeSocketId?: string | null): void };
}

export interface BitSocketServerConfig {
  /** TCP port to listen on — required unless `server` is provided */
  port?:       number;
  /** Attach to an existing http.Server */
  server?:     any;
  protocol?:   BitSocketProtocolType;
  useSchemas?: boolean;
  cors?:       { origin?: string | string[] };
}

export declare class BitSocketServer {
  constructor(config: BitSocketServerConfig);

  readonly protocol:   BitSocketProtocolType;
  /** Raw `ws.WebSocketServer` */
  readonly wss:        any;
  readonly namespaces: Record<string, Namespace>;

  of(name: string): Namespace;
  use(fn: (socket: ServerSocket, next: (err?: Error) => void) => void): this;

  on(event: 'connection', callback: (socket: ServerSocket) => void): this;
  on(event: string | Schema, callback: (payload: any) => void): this;

  emit(event: string | Schema, payload: any): void;
  to(room: string, targetNamespace?: string): {
    emit(event: string | Schema, payload: any, excludeSocketId?: string | null): void;
  };

  /** Generates a TypeScript `.d.ts` string from registered schemas */
  generateTypeScriptDefinitions(): string;
  /** Writes the generated TypeScript definitions to `filePath` */
  exportTypeScript(filePath: string): string;

  close(): void;
}

// ─────────────────────────────────────────────────────────────
// Client — Browser / Vite / Bundler
// ─────────────────────────────────────────────────────────────

export declare class ClientNamespace {
  readonly nsp: string;

  schema(schemas: Schema | Schema[]): this;
  on(event: string | Schema, callback: (payload: any) => void): void;
  emit(event: string | Schema, payload: any, callback?: (response: any) => void): void;
  join(room: string): void;
  leave(room: string): void;
  close(): void;
  use(fn: (packet: [string, any], next: (err?: Error) => void) => void): this;
}

export interface BitSocketClientOptions {
  protocol?:     BitSocketProtocolType;
  useSchemas?:   boolean;
  autoReconnect?: boolean;
  /** Max reconnection attempts before giving up (default: 15) */
  maxAttempts?:  number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?:    number;
  /** Max reconnect delay in ms (default: 7000) */
  maxDelay?:     number;
  /** Root namespace (default: '/') */
  nsp?:          string;
}

export declare class BitSocketClient {
  constructor(url: string, options?: BitSocketClientOptions);

  readonly url:        string;
  readonly protocol:   BitSocketProtocolType;
  /** All discovered/registered schemas, keyed by namespace then event name */
  readonly schemas:    { [nsp: string]: Schema | { [event: string]: Schema } };
  readonly namespaces: Record<string, ClientNamespace>;
  /** Raw browser WebSocket instance */
  readonly ws:         WebSocket;

  /** Set to false to prevent automatic reconnection */
  autoReconnect: boolean;

  of(nsp: string): ClientNamespace;

  on(event: string | Schema, callback: (payload: any) => void): void;
  emit(event: string | Schema, payload: any, callback?: (response: any) => void): void;
  join(room: string): void;
  leave(room: string): void;
  schema(schemas: Schema | Schema[]): this;
  use(fn: (packet: [string, any], next: (err?: Error) => void) => void): this;
  close(): void;
}
