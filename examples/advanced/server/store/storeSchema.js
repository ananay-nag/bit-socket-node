import { Schema } from '../../../../src/protocol/index.js';

export const StoreSchemas = [
  new Schema('STORE_PURCHASE', {
    itemId: 'uint32',
    quantity: 'uint8'
  }),
  new Schema('STORE_RECEIPT', {
    orderId: 'string',
    status: 'boolean'
  })
];
