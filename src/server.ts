import { createServer } from 'http';
import app from './app';
import { WebSocketService } from './services/websocketService';

const PORT = process.env.PORT || 3002;

// Create HTTP server with Express app
const httpServer = createServer(app);

// Initialize WebSocket service AFTER creating HTTP server
try {
  const io = WebSocketService.initialize(httpServer);
  console.log('✅ WebSocket service initialization completed');
  
  // Add Socket.IO info endpoint
  app.get('/socket.io/info', (req, res) => {
    res.json({
      socketio: {
        version: require('socket.io/package.json').version,
        initialized: true,
        connectedClients: WebSocketService.getStats().connectedClients,
        transports: ['websocket', 'polling']
      }
    });
  });
} catch (error) {
  console.error('❌ Failed to initialize WebSocket service:', error);
}

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🌐 Frontend should connect to: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('⏹️  SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⏹️  SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default httpServer;
