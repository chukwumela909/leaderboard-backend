import { Server as HTTPServer } from 'http';
import express from 'express';
import { WebSocketService } from '../../src/services/websocketService';
import { delay, sampleScore, sampleLeaderboard } from '../utils';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';

describe('WebSocket Integration Tests', () => {
  let httpServer: HTTPServer;
  let websocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverAddress: string;

  beforeAll((done) => {
    const app = express();
    httpServer = new HTTPServer(app);
    
    websocketService = new WebSocketService();
    websocketService.initialize(httpServer);

    httpServer.listen(() => {
      const address = httpServer.address();
      const port = typeof address === 'string' ? address : address?.port;
      serverAddress = `http://localhost:${port}`;
      done();
    });
  });

  afterAll((done) => {
    httpServer.close(done);
  });

  beforeEach((done) => {
    clientSocket = ClientIO(serverAddress, {
      transports: ['websocket'],
    });
    
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection and Basic Events', () => {
    it('should connect successfully', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    it('should receive welcome message on connection', (done) => {
      clientSocket.on('welcome', (data) => {
        expect(data.message).toContain('Connected to leaderboard WebSocket');
        expect(data.socketId).toBeDefined();
        done();
      });
    });

    it('should handle ping-pong', (done) => {
      const testData = { timestamp: Date.now() };
      
      clientSocket.on('pong', (data) => {
        expect(data).toEqual(testData);
        done();
      });

      clientSocket.emit('ping', testData);
    });

    it('should join leaderboard room', (done) => {
      clientSocket.on('joined-leaderboard', (data) => {
        expect(data.message).toBe('Successfully joined leaderboard updates');
        expect(data.room).toBe('leaderboard');
        done();
      });

      clientSocket.emit('join-leaderboard');
    });

    it('should leave leaderboard room', (done) => {
      // First join the room
      clientSocket.emit('join-leaderboard');
      
      clientSocket.on('left-leaderboard', (data) => {
        expect(data.message).toBe('Left leaderboard updates');
        expect(data.room).toBe('leaderboard');
        done();
      });

      // Give a small delay then leave
      setTimeout(() => {
        clientSocket.emit('leave-leaderboard');
      }, 50);
    });

    it('should get connection statistics', (done) => {
      clientSocket.on('stats', (data) => {
        expect(data.connectedClients).toBeGreaterThanOrEqual(1);
        expect(data.timestamp).toBeDefined();
        done();
      });

      clientSocket.emit('get-stats');
    });
  });

  describe('Broadcast Events', () => {
    beforeEach((done) => {
      // Join leaderboard room before testing broadcasts
      clientSocket.emit('join-leaderboard');
      clientSocket.on('joined-leaderboard', () => done());
    });

    it('should receive high score notifications', (done) => {
      const highScoreData = {
        userId: 'test-user',
        username: 'testuser',
        score: 1500,
        timestamp: new Date().toISOString(),
      };

      clientSocket.on('HIGH_SCORE', (data) => {
        expect(data.type).toBe('HIGH_SCORE');
        expect(data.data).toEqual(highScoreData);
        expect(data.message).toContain('testuser achieved a high score of 1500');
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Trigger high score broadcast
      websocketService.broadcastHighScore(highScoreData);
    });

    it('should receive leaderboard updates', (done) => {
      clientSocket.on('LEADERBOARD_UPDATE', (data) => {
        expect(data.type).toBe('LEADERBOARD_UPDATE');
        expect(data.data).toEqual(sampleLeaderboard);
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Trigger leaderboard update broadcast
      websocketService.broadcastLeaderboardUpdate(sampleLeaderboard);
    });

    it('should receive new player notifications', (done) => {
      const newPlayerData = {
        userId: 'new-player-123',
        username: 'newplayer',
      };

      clientSocket.on('NEW_PLAYER', (data) => {
        expect(data.type).toBe('NEW_PLAYER');
        expect(data.data).toEqual(newPlayerData);
        expect(data.message).toContain('Welcome newplayer to the leaderboard');
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Trigger new player broadcast
      websocketService.broadcastNewPlayer(newPlayerData);
    });

    it('should receive custom notifications', (done) => {
      const customNotification = {
        type: 'CUSTOM_EVENT',
        message: 'This is a custom message',
        data: { customField: 'customValue' },
      };

      clientSocket.on('notification', (data) => {
        expect(data.type).toBe('CUSTOM_EVENT');
        expect(data.message).toBe('This is a custom message');
        expect(data.data).toEqual({ customField: 'customValue' });
        expect(data.timestamp).toBeDefined();
        done();
      });

      // Trigger custom notification
      websocketService.sendNotification(customNotification);
    });
  });

  describe('Multiple Clients', () => {
    let secondClient: ClientSocket;

    beforeEach((done) => {
      secondClient = ClientIO(serverAddress, {
        transports: ['websocket'],
      });
      secondClient.on('connect', done);
    });

    afterEach(() => {
      if (secondClient.connected) {
        secondClient.disconnect();
      }
    });

    it('should handle multiple simultaneous connections', async () => {
      expect(clientSocket.connected).toBe(true);
      expect(secondClient.connected).toBe(true);

      const connectedCount = websocketService.getConnectedClientsCount();
      expect(connectedCount).toBeGreaterThanOrEqual(2);
    });

    it('should broadcast to all connected clients', (done) => {
      let receivedCount = 0;
      const expectedData = {
        userId: 'broadcast-test',
        username: 'broadcastuser',
        score: 2000,
        timestamp: new Date().toISOString(),
      };

      const checkDone = () => {
        receivedCount++;
        if (receivedCount === 2) {
          done();
        }
      };

      clientSocket.on('HIGH_SCORE', (data) => {
        expect(data.data).toEqual(expectedData);
        checkDone();
      });

      secondClient.on('HIGH_SCORE', (data) => {
        expect(data.data).toEqual(expectedData);
        checkDone();
      });

      // Broadcast to all clients
      websocketService.broadcastHighScore(expectedData);
    });

    it('should track connection count correctly', async () => {
      const initialCount = websocketService.getConnectedClientsCount();
      
      // Disconnect second client
      secondClient.disconnect();
      
      // Wait for disconnection to be processed
      await delay(100);
      
      const finalCount = websocketService.getConnectedClientsCount();
      expect(finalCount).toBe(initialCount - 1);
    });
  });

  describe('Room Management', () => {
    let secondClient: ClientSocket;

    beforeEach((done) => {
      secondClient = ClientIO(serverAddress, {
        transports: ['websocket'],
      });
      secondClient.on('connect', done);
    });

    afterEach(() => {
      if (secondClient.connected) {
        secondClient.disconnect();
      }
    });

    it('should only send leaderboard updates to clients in leaderboard room', (done) => {
      let clientReceived = false;
      let secondClientReceived = false;

      // Only first client joins leaderboard room
      clientSocket.emit('join-leaderboard');
      clientSocket.on('joined-leaderboard', () => {
        // Set up listeners
        clientSocket.on('LEADERBOARD_UPDATE', () => {
          clientReceived = true;
        });

        secondClient.on('LEADERBOARD_UPDATE', () => {
          secondClientReceived = true;
        });

        // Broadcast leaderboard update
        websocketService.broadcastLeaderboardUpdate(sampleLeaderboard);

        // Check results after delay
        setTimeout(() => {
          expect(clientReceived).toBe(true);
          expect(secondClientReceived).toBe(false);
          done();
        }, 200);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle client disconnection gracefully', (done) => {
      const initialCount = websocketService.getConnectedClientsCount();
      
      clientSocket.on('disconnect', () => {
        // Wait for server to process disconnection
        setTimeout(() => {
          const finalCount = websocketService.getConnectedClientsCount();
          expect(finalCount).toBe(initialCount - 1);
          done();
        }, 100);
      });

      clientSocket.disconnect();
    });

    it('should handle invalid event data gracefully', (done) => {
      // Send invalid ping data
      clientSocket.emit('ping', null);
      
      // Should still receive pong
      clientSocket.on('pong', (data) => {
        expect(data).toBe(null);
        done();
      });
    });

    it('should handle unknown events gracefully', () => {
      // This should not crash the server
      expect(() => {
        clientSocket.emit('unknown-event', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle rapid successive events', (done) => {
      let receivedCount = 0;
      const totalEvents = 10;

      clientSocket.on('HIGH_SCORE', () => {
        receivedCount++;
        if (receivedCount === totalEvents) {
          done();
        }
      });

      // Send multiple events rapidly
      for (let i = 0; i < totalEvents; i++) {
        websocketService.broadcastHighScore({
          userId: `user-${i}`,
          username: `user${i}`,
          score: 1000 + i,
          timestamp: new Date().toISOString(),
        });
      }
    });

    it('should maintain connection under load', async () => {
      const operations = [];
      
      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        operations.push(new Promise((resolve) => {
          clientSocket.emit('ping', { test: i });
          clientSocket.once('pong', resolve);
        }));
      }

      await Promise.all(operations);
      expect(clientSocket.connected).toBe(true);
    });
  });
});
