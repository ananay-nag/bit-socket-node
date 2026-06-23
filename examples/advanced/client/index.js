import { BitSocketClient } from '../../../src/client/index.js';
import WebSocket from 'ws';
global.WebSocket = WebSocket; // Polyfill for Node.js

// Connect ONE root instance
const root = new BitSocketClient('ws://localhost:5015');





// Multiplex channels off the root connection!
const userClient = root.of('/user');
// const storeClient = root.of('/store');

userClient.on('connect', () => {
  console.log("\n[Client] Connected to /user.");
  console.log("Auto-synced /user Schemas:", Object.keys(root.schemas.user || {}));

  // We can use the schema constant directly!
  userClient.on(root.schemas.user.USER_CREATED, (res) => {
    console.log("[Client] Received User Creation Receipt:", res);
  });

  // Emit using schema constant directly!
  console.log("[Client] Sending 'user:create'...");
  userClient.emit(root.schemas.user.USER_CREATE, { name: "Alice", age: 27 });
});

// storeClient.on('connect', () => {
//   console.log("\n[Client] Connected to /store.");
//   console.log("Auto-synced /store Schemas:", Object.keys(root.schemas.store || {}));

//   storeClient.on(root.schemas.store.STORE_RECEIPT, (res) => {
//     console.log("[Client] Received Store Purchase Receipt:", res);

//     // Close root connection after we are done
//     setTimeout(() => {
//       console.log("\n[Client] Closing multiplexed connection.");
//       root.close();
//       process.exit(0);
//     }, 500);
//   });

//   // Emit using schema
//   console.log("[Client] Sending 'store:purchase'...");
//   storeClient.emit(root.schemas.store.STORE_PURCHASE, { itemId: 999, quantity: 2 });
// });
