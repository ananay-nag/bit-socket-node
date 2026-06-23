export function registerStoreController(io) {
  const storeNsp = io.of('/store');

  storeNsp.on('connection', (socket) => {
    console.log(`[StoreController] Store client connected: ${socket.id}`);

    socket.on('STORE_PURCHASE', (payload) => {
      console.log(`[StoreController] Processing purchase:`, payload);

      // Emit response directly to sender
      storeNsp.to(socket.id).emit('STORE_RECEIPT', {
        orderId: `ORD-${Date.now()}`,
        status: true
      });
    });
  });
}
