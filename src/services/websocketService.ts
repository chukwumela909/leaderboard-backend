import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { WebSocketNotification } from '../types';

interface NotificationPayload {
  type: string;
  message: string;
  score: number;
  username: string;
  timestamp: string;
}

export class WebSocketService {
  private static io: SocketIOServer | null = null;
  private static connectedClients = new Set<string>();

  // Initialize Socket.IO server
  static initialize(httpServer: HTTPServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6
    });

    this.setupEventHandlers();
    console.log('🔌 WebSocket service initialized');
    console.log('🌐 CORS origins:', ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"]);
    console.log('🚀 Available transports: websocket, polling');
    return this.io;
  }

  // Setup Socket.IO event handlers
  private static setupEventHandlers(): void {
    if (!this.io) return;

    console.log('🔧 Setting up WebSocket event handlers...');

    this.io.on('connection', (socket) => {
      console.log(`👋 Client connected: ${socket.id} from ${socket.handshake.address}`);
      this.connectedClients.add(socket.id);

      // Send welcome message
      socket.emit('welcome', {
        message: 'Connected to leaderboard WebSocket',
        timestamp: new Date().toISOString(),
        socketId: socket.id
      });

      console.log(`📊 Total connected clients: ${this.connectedClients.size}`);

      // Handle client requesting current leaderboard
      socket.on('request_leaderboard', async () => {
        try {
          // Import here to avoid circular dependency
          const { DynamoService } = await import('./dynamoService');
          const result = await DynamoService.getTopScores(10);
          
          if (result.success) {
            socket.emit('leaderboard_update', {
              type: 'LEADERBOARD_DATA',
              topScores: result.scores?.map(score => ({
                username: score.username,
                score: score.score,
                timestamp: score.timestamp
              })) || [],
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error fetching leaderboard for client:', error);
        }
      });

      // Handle client disconnect
      socket.on('disconnect', (reason) => {
        console.log(`👋 Client disconnected: ${socket.id}, reason: ${reason}`);
        this.connectedClients.delete(socket.id);
        console.log(`📊 Total connected clients: ${this.connectedClients.size}`);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
      });
    });
  }

  // Send notification to all connected clients
  static async sendNotification(payload: WebSocketNotification): Promise<void> {
    try {
      if (!this.io) {
        console.log('📢 WebSocket not initialized, logging notification:', payload);
        return;
      }

      console.log(`📢 Broadcasting to ${this.connectedClients.size} clients:`, payload);
      
      // Broadcast to all connected clients
      this.io.emit('notification', payload);

      // Also emit specific event types
      switch (payload.type) {
        case 'HIGH_SCORE':
          this.io.emit('high_score', payload);
          break;
        case 'NEW_PLAYER':
          this.io.emit('new_player', payload);
          break;
      }

      return Promise.resolve();
    } catch (error) {
      console.error('WebSocket service error:', error);
      throw error;
    }
  }

  // Send leaderboard update to all clients
  static async broadcastLeaderboardUpdate(topScores: any[]): Promise<void> {
    try {
      if (!this.io) {
        console.log('📊 WebSocket not initialized, cannot broadcast leaderboard update');
        return;
      }

      const payload = {
        type: 'LEADERBOARD_UPDATE',
        topScores: topScores.map(score => ({
          username: score.username,
          score: score.score,
          timestamp: score.timestamp
        })),
        timestamp: new Date().toISOString()
      };

      console.log(`📊 Broadcasting leaderboard update to ${this.connectedClients.size} clients`);
      this.io.emit('leaderboard_update', payload);

      return Promise.resolve();
    } catch (error) {
      console.error('Leaderboard broadcast error:', error);
      throw error;
    }
  }

  // Helper method to format high score notification
  static async notifyHighScore(username: string, score: number): Promise<void> {
    await this.sendNotification({
      type: 'HIGH_SCORE',
      message: `🎉 ${username} achieved a high score of ${score.toLocaleString()}!`,
      score,
      username,
      timestamp: new Date().toISOString()
    });
  }

  // Helper method to notify new player joined
  static async notifyNewPlayer(username: string): Promise<void> {
    await this.sendNotification({
      type: 'NEW_PLAYER',
      message: `👋 ${username} joined the leaderboard!`,
      username,
      timestamp: new Date().toISOString()
    });
  }

  // Get connection statistics
  static getStats(): { connectedClients: number; isInitialized: boolean } {
    return {
      connectedClients: this.connectedClients.size,
      isInitialized: this.io !== null
    };
  }

  // Get Socket.IO instance (for external use if needed)
  static getIO(): SocketIOServer | null {
    return this.io;
  }
}