import { BitSocketServer } from '../../../src/server/index.js';
import { UserSchemas } from './user/userSchema.js';
import { registerUserController } from './user/userController.js';
import { StoreSchemas } from './store/storeSchema.js';
import { registerStoreController } from './store/storeController.js';

const io = new BitSocketServer({ port: 5016 });

// Register Schemas globally to their respective namespaces
io.of('/user').schema(UserSchemas);
io.of('/store').schema(StoreSchemas);

// Generate end-to-end TypeScript definitions for the client!
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
io.exportTypeScript(path.join(__dirname, '../client/bitsocket.d.ts'));
console.log("Exported TypeScript Definitions to ../client/bitsocket.d.ts");

// Initialize Controllers
registerUserController(io);
registerStoreController(io);

console.log("MVC BitSocket Server running on port 5016");
