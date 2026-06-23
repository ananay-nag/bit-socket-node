// Auto-generated BitSocket Types
// Do not edit directly

export namespace BitSocketSchemas {
  export interface RootSchemas {
  }
  export interface UserSchemas {
    USER_CREATE: {
      name: string;
      age: number;
    };
    USER_CREATED: {
      id: number;
      success: boolean;
    };
  }
  export interface StoreSchemas {
    STORE_PURCHASE: {
      itemId: number;
      quantity: number;
    };
    STORE_RECEIPT: {
      orderId: string;
      status: boolean;
    };
  }
}
