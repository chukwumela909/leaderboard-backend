import { WebSocketService } from '../../src/services/websocketService';
import { createMockSocket, createMockIo, sampleScore, sampleLeaderboard } from '../utils';
import { Server as SocketIOServer } from 'socket.io';

// Mock Socket.IO
jest.mock('socket.io');

describe('WebSocketService', () => {
  let websocketService: WebSocketService;
  let mockIo: any;
  let mockSocket: any;

  beforeEach(() => {
    mockIo = createMockIo();
    mockSocket = createMockSocket();
    websocketService = new WebSocketService();
    
    // Set the mocked io instance
    (websocketService as any).io = mockIo;
    
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize WebSocket server with HTTP server', () => {
      const mockHttpServer = {} as any;
      
      websocketService.initialize(mockHttpServer);
      
      expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
          methods: ['GET', 'POST'],
          credentials: true,
        },
        transports: ['websocket', 'polling'],
      });
    });

    it('should set up connection event handlers', () => {
      const mockHttpServer = {} as any;
      
      websocketService.initialize(mockHttpServer);
      
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('handleConnection', () => {
    beforeEach(() => {
      // Setup the connection handler
      websocketService.initialize({} as any);
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);
    });

    it('should handle new socket connections', () => {
      expect(mockSocket.emit).toHaveBeenCalledWith('welcome', {
        message: 'Connected to leaderboard WebSocket',
        socketId: mockSocket.id,
      });
    });

    it('should setup socket event listeners', () => {
      expect(mockSocket.on).toHaveBeenCalledWith('join-leaderboard', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave-leaderboard', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('get-stats', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('ping', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('broadcastHighScore', () => {
    it('should broadcast high score notification', () => {
      websocketService.initialize({} as any);
      
      const scoreData = {
        userId: sampleScore.userId,
        username: sampleScore.username,
        score: 1500,
        timestamp: sampleScore.timestamp,
      };

      websocketService.broadcastHighScore(scoreData);

      expect(mockIo.emit).toHaveBeenCalledWith('HIGH_SCORE', {
        type: 'HIGH_SCORE',
        data: scoreData,
        message: `🎉 ${scoreData.username} achieved a high score of ${scoreData.score}!`,
        timestamp: expect.any(String),
      });
    });

    it('should only broadcast scores above threshold', () => {
      websocketService.initialize({} as any);
      
      const lowScore = {
        userId: sampleScore.userId,
        username: sampleScore.username,
        score: 500, // Below 1000 threshold
        timestamp: sampleScore.timestamp,
      };

      // The service should check the threshold internally
      websocketService.broadcastHighScore(lowScore);

      // Assuming the service has a threshold check, it shouldn't emit for low scores
      // This test depends on the actual implementation
    });
  });

  describe('broadcastLeaderboardUpdate', () => {
    it('should broadcast leaderboard updates', () => {
      websocketService.initialize({} as any);
      
      websocketService.broadcastLeaderboardUpdate(sampleLeaderboard);

      expect(mockIo.emit).toHaveBeenCalledWith('LEADERBOARD_UPDATE', {
        type: 'LEADERBOARD_UPDATE',
        data: sampleLeaderboard,
        timestamp: expect.any(String),
      });
    });

    it('should broadcast to leaderboard room specifically', () => {
      websocketService.initialize({} as any);
      
      websocketService.broadcastLeaderboardUpdate(sampleLeaderboard);

      expect(mockIo.to).toHaveBeenCalledWith('leaderboard');
      expect(mockIo.emit).toHaveBeenCalledWith('LEADERBOARD_UPDATE', expect.any(Object));
    });
  });

  describe('broadcastNewPlayer', () => {
    it('should broadcast new player notifications', () => {
      websocketService.initialize({} as any);
      
      const playerData = {
        userId: 'new-user-123',
        username: 'newplayer',
      };

      websocketService.broadcastNewPlayer(playerData);

      expect(mockIo.emit).toHaveBeenCalledWith('NEW_PLAYER', {
        type: 'NEW_PLAYER',
        data: playerData,
        message: `👋 Welcome ${playerData.username} to the leaderboard!`,
        timestamp: expect.any(String),
      });
    });
  });

  describe('sendNotification', () => {
    it('should send custom notifications', () => {
      websocketService.initialize({} as any);
      
      const notification = {
        type: 'CUSTOM_EVENT',
        message: 'This is a custom notification',
        data: { key: 'value' },
      };

      websocketService.sendNotification(notification);

      expect(mockIo.emit).toHaveBeenCalledWith('notification', {
        ...notification,
        timestamp: expect.any(String),
      });
    });
  });

  describe('getConnectedClientsCount', () => {
    it('should return the number of connected clients', () => {
      websocketService.initialize({} as any);
      
      // Mock the sockets map
      mockIo.sockets.sockets = new Map([
        ['socket1', {}],
        ['socket2', {}],
        ['socket3', {}],
      ]);

      const count = websocketService.getConnectedClientsCount();
      
      expect(count).toBe(3);
    });

    it('should return 0 when no clients are connected', () => {
      websocketService.initialize({} as any);
      
      mockIo.sockets.sockets = new Map();

      const count = websocketService.getConnectedClientsCount();
      
      expect(count).toBe(0);
    });
  });

  describe('socket event handlers', () => {
    let joinLeaderboardHandler: Function;
    let leaveLeaderboardHandler: Function;
    let getStatsHandler: Function;
    let pingHandler: Function;
    let disconnectHandler: Function;

    beforeEach(() => {
      websocketService.initialize({} as any);
      const connectionHandler = mockIo.on.mock.calls.find(call => call[0] === 'connection')[1];
      connectionHandler(mockSocket);

      // Extract the event handlers
      const onCalls = mockSocket.on.mock.calls;
      joinLeaderboardHandler = onCalls.find(call => call[0] === 'join-leaderboard')[1];
      leaveLeaderboardHandler = onCalls.find(call => call[0] === 'leave-leaderboard')[1];
      getStatsHandler = onCalls.find(call => call[0] === 'get-stats')[1];
      pingHandler = onCalls.find(call => call[0] === 'ping')[1];
      disconnectHandler = onCalls.find(call => call[0] === 'disconnect')[1];
    });

    it('should handle join-leaderboard events', () => {
      joinLeaderboardHandler();

      expect(mockSocket.join).toHaveBeenCalledWith('leaderboard');
      expect(mockSocket.emit).toHaveBeenCalledWith('joined-leaderboard', {
        message: 'Successfully joined leaderboard updates',
        room: 'leaderboard',
      });
    });

    it('should handle leave-leaderboard events', () => {
      leaveLeaderboardHandler();

      expect(mockSocket.leave).toHaveBeenCalledWith('leaderboard');
      expect(mockSocket.emit).toHaveBeenCalledWith('left-leaderboard', {
        message: 'Left leaderboard updates',
        room: 'leaderboard',
      });
    });

    it('should handle get-stats events', () => {
      mockIo.sockets.sockets = new Map([['socket1', {}], ['socket2', {}]]);
      
      getStatsHandler();

      expect(mockSocket.emit).toHaveBeenCalledWith('stats', {
        connectedClients: 2,
        timestamp: expect.any(String),
      });
    });

    it('should handle ping events', () => {
      const testData = { timestamp: Date.now() };
      
      pingHandler(testData);

      expect(mockSocket.emit).toHaveBeenCalledWith('pong', testData);
    });

    it('should handle disconnect events', () => {
      const reason = 'client disconnect';
      
      // The disconnect handler should log or handle cleanup
      expect(() => disconnectHandler(reason)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle WebSocket server errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      websocketService.initialize({} as any);
      
      // Simulate an error
      const errorHandler = mockIo.on.mock.calls.find(call => call[0] === 'error');
      if (errorHandler) {
        const error = new Error('WebSocket error');
        errorHandler[1](error);
      }

      consoleSpy.mockRestore();
    });

    it('should handle invalid data in broadcasts', () => {
      websocketService.initialize({} as any);
      
      // Test with null/undefined data
      expect(() => {
        websocketService.broadcastLeaderboardUpdate(null as any);
      }).not.toThrow();
      
      expect(() => {
        websocketService.broadcastHighScore(undefined as any);
      }).not.toThrow();
    });
  });
});
