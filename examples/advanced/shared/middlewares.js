/**
 * Shared Middleware Library
 * These middlewares can be used on BOTH the server and the client!
 */

// 1. Authentication Handler
// On Server: Validates the JWT/secret token.
// On Client: Passed through since client initiates the auth via handshake headers.
export function socketAuthHandler(secretKey) {
  return (socket, next) => {
    // If running on SERVER, socket.handshake exists
    if (socket.handshake) {
      const token = socket.handshake.headers['authorization'];
      if (token === secretKey) {
        return next();
      } else {
        return next(new Error("JWT Validation Failed: Unauthorized"));
      }
    } 
    // If running on CLIENT, connection middleware just passes through
    else {
      next();
    }
  };
}

// 2. Universal Data Logger (In & Out)
// Tracks exactly what data travels through the BitSocket pipeline
export function loggerHandler(socket) {
  const side = socket.handshake ? "SERVER" : "CLIENT";

  // A) Intercept all OUTGOING data by wrapping socket.emit
  const originalEmit = socket.emit;
  socket.emit = function (event, payload, ...args) {
    console.log(`[${side} OUT] -> Event: '${event}' | Payload:`, payload);
    originalEmit.apply(socket, [event, payload, ...args]);
  };

  // B) Return the Event Middleware to intercept all INCOMING data
  return (packet, next) => {
    console.log(`[${side} IN] <- Event: '${packet[0]}' | Payload:`, packet[1]);
    next();
  };
}
