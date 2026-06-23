import { Schema } from '../../../../src/protocol/index.js';

export const UserSchemas = [
  // Schema for receiving data from client
  new Schema('USER_CREATE', {
    name: 'string',
    age: 'uint8'
  }),
  // Schema for sending response to client
  new Schema('USER_CREATED', {
    id: 'uint32',
    success: 'boolean'
  })
];
