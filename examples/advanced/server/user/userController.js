export function registerUserController(io) {
  const userNsp = io.of('/user');

  userNsp.on('connection', (socket) => {
    console.log(`[UserController] User connected: ${socket.id}`);

    // Listen to the strongly-typed 'USER_CREATE' event
    socket.on('USER_CREATE', (payload) => {
      console.log(`[UserController] Creating user:`, payload);

      // Save user to DB here...
      const newUserId = Math.floor(Math.random() * 10000);

      // Respond directly to the socket ID that requested it
      userNsp.to(socket.id).emit('USER_CREATED', {
        id: newUserId,
        success: true
      });
    });
  });
}
