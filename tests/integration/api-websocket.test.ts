import request from 'supertest';
import { Server as HTTPServer } from 'http';
import express from 'express';
import { WebSocketService } from '../../src/services/websocketService';
import { scoreRoutes } from '../../src/routes/scores';
import { leaderboardRoutes } from '../../src/routes/leaderboard';
import { createTestToken, sampleUser, delay } from '../utils';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';

// Mock services
jest.mock('../../src/services/dynamoService');
jest.mock('../../src/services/authService');

const mockDynamoService = require('../../src/services/dynamoService').DynamoService;
const mockAuthService = require('../../src/services/authService').AuthService;

describe('End-to-End API + WebSocket Tests', () => {
  let app: express.Application;
  let httpServer: HTTPServer;
  let websocketService: WebSocketService;
  let clientSocket: ClientSocket;
  let serverAddress: string;

  beforeAll((done) => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    app.use((req: any, res, next) => {
      req.user = sampleUser;
      next();
    });

    // Add routes
    app.use('/scores', scoreRoutes);
    app.use('/leaderboard', leaderboardRoutes);

    // Create HTTP server
    httpServer = new HTTPServer(app);
    
    // Initialize WebSocket service
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
    // Setup fresh mocks
    jest.clearAllMocks();

    // Mock auth service
    mockAuthService.verifyToken.mockResolvedValue({
      success: true,
      user: sampleUser,
    });

    // Connect WebSocket client
    clientSocket = ClientIO(serverAddress, {
      transports: ['websocket'],
    });
    
    clientSocket.on('connect', () => {
      clientSocket.emit('join-leaderboard');
      clientSocket.on('joined-leaderboard', () => done());
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Score Submission with Real-time Notifications', () => {
    it('should submit score and trigger real-time high score notification', (done) => {
      const highScore = 1500;
      const scoreData = {
        userId: sampleUser.userId,
        username: sampleUser.username,
        score: highScore,
        timestamp: new Date().toISOString(),
      };

      // Mock successful score save
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: scoreData,
      });

      // Listen for WebSocket notification
      clientSocket.on('HIGH_SCORE', (notification) => {
        expect(notification.type).toBe('HIGH_SCORE');
        expect(notification.data.score).toBe(highScore);
        expect(notification.data.username).toBe(sampleUser.username);
        expect(notification.message).toContain(`${sampleUser.username} achieved a high score of ${highScore}`);
        done();
      });

      // Submit score via API
      request(app)
        .post('/scores/submit')
        .send({ score: highScore })
        .expect(201)
        .end((err) => {
          if (err) done(err);
        });
    });

    it('should submit low score without triggering high score notification', (done) => {
      const lowScore = 500;
      const scoreData = {
        userId: sampleUser.userId,
        username: sampleUser.username,
        score: lowScore,
        timestamp: new Date().toISOString(),
      };

      // Mock successful score save
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: scoreData,
      });

      let highScoreReceived = false;

      // Listen for WebSocket notification (should not receive)
      clientSocket.on('HIGH_SCORE', () => {
        highScoreReceived = true;
      });

      // Submit score via API
      request(app)
        .post('/scores/submit')
        .send({ score: lowScore })
        .expect(201)
        .end((err) => {
          if (err) {
            done(err);
            return;
          }

          // Wait to ensure no notification is sent
          setTimeout(() => {
            expect(highScoreReceived).toBe(false);
            done();
          }, 200);
        });
    });
  });

  describe('Leaderboard Updates', () => {
    it('should update leaderboard and broadcast to connected clients', (done) => {
      const updatedLeaderboard = [
        {
          userId: sampleUser.userId,
          username: sampleUser.username,
          score: 2000,
          timestamp: new Date().toISOString(),
        },
        {
          userId: 'user-2',
          username: 'player2',
          score: 1500,
          timestamp: new Date().toISOString(),
        },
      ];

      // Mock leaderboard retrieval
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: updatedLeaderboard,
      });

      // Listen for leaderboard update
      clientSocket.on('LEADERBOARD_UPDATE', (notification) => {
        expect(notification.type).toBe('LEADERBOARD_UPDATE');
        expect(notification.data).toEqual(updatedLeaderboard);
        done();
      });

      // Get leaderboard via API (this could trigger an update)
      request(app)
        .get('/leaderboard')
        .expect(200)
        .end((err, res) => {
          if (err) {
            done(err);
            return;
          }

          // Manually trigger broadcast for this test
          websocketService.broadcastLeaderboardUpdate(updatedLeaderboard);
        });
    });

    it('should handle concurrent score submissions with real-time updates', async () => {
      const submissions = [
        { userId: 'user-1', username: 'player1', score: 1200 },
        { userId: 'user-2', username: 'player2', score: 1300 },
        { userId: 'user-3', username: 'player3', score: 1100 },
      ];

      let notificationCount = 0;
      const receivedNotifications: any[] = [];

      return new Promise((resolve, reject) => {
        // Listen for high score notifications
        clientSocket.on('HIGH_SCORE', (notification) => {
          receivedNotifications.push(notification);
          notificationCount++;

          if (notificationCount === submissions.length) {
            try {
              expect(receivedNotifications.length).toBe(3);
              receivedNotifications.forEach((notification, index) => {
                expect(notification.data.score).toBe(submissions[index].score);
                expect(notification.data.username).toBe(submissions[index].username);
              });
              resolve(undefined);
            } catch (error) {
              reject(error);
            }
          }
        });

        // Mock score saves
        submissions.forEach((submission) => {
          mockDynamoService.prototype.saveScore.mockResolvedValueOnce({
            success: true,
            data: {
              ...submission,
              timestamp: new Date().toISOString(),
            },
          });
        });

        // Submit all scores concurrently
        const submissionPromises = submissions.map((submission) => {
          // Override user for each submission
          return request(app)
            .post('/scores/submit')
            .send({ score: submission.score })
            .expect(201);
        });

        Promise.all(submissionPromises).catch(reject);

        // Timeout after 5 seconds
        setTimeout(() => {
          reject(new Error('Test timeout'));
        }, 5000);
      });
    });
  });

  describe('Real-time Statistics', () => {
    it('should provide real-time connection statistics', (done) => {
      clientSocket.on('stats', (data) => {
        expect(data.connectedClients).toBeGreaterThanOrEqual(1);
        expect(data.timestamp).toBeDefined();
        expect(new Date(data.timestamp).getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
        done();
      });

      clientSocket.emit('get-stats');
    });

    it('should track multiple clients correctly', async () => {
      // Connect second client
      const secondClient = ClientIO(serverAddress, {
        transports: ['websocket'],
      });

      await new Promise((resolve) => {
        secondClient.on('connect', resolve);
      });

      await new Promise((resolve) => {
        clientSocket.on('stats', (data) => {
          expect(data.connectedClients).toBeGreaterThanOrEqual(2);
          resolve(undefined);
        });

        clientSocket.emit('get-stats');
      });

      secondClient.disconnect();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle API errors gracefully while maintaining WebSocket connection', (done) => {
      // Mock database error
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      // Submit score that will fail
      request(app)
        .post('/scores/submit')
        .send({ score: 1500 })
        .expect(500)
        .end((err, res) => {
          if (err) {
            done(err);
            return;
          }

          expect(res.body.error).toBe('Database connection failed');

          // Verify WebSocket connection is still active
          clientSocket.emit('ping', { test: 'after-error' });
          clientSocket.on('pong', (data) => {
            expect(data.test).toBe('after-error');
            done();
          });
        });
    });

    it('should handle WebSocket errors without affecting API functionality', async () => {
      // Disconnect WebSocket
      clientSocket.disconnect();

      // Mock successful API operation
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: [],
      });

      // API should still work
      const response = await request(app)
        .get('/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple rapid API calls with WebSocket notifications', async () => {
      const numberOfCalls = 10;
      const scores = Array.from({ length: numberOfCalls }, (_, i) => 1000 + i * 100);
      
      let notificationCount = 0;

      return new Promise((resolve, reject) => {
        // Listen for notifications
        clientSocket.on('HIGH_SCORE', () => {
          notificationCount++;
          if (notificationCount === numberOfCalls) {
            expect(notificationCount).toBe(numberOfCalls);
            resolve(undefined);
          }
        });

        // Mock successful saves
        scores.forEach((score, index) => {
          mockDynamoService.prototype.saveScore.mockResolvedValueOnce({
            success: true,
            data: {
              userId: `user-${index}`,
              username: `player${index}`,
              score,
              timestamp: new Date().toISOString(),
            },
          });
        });

        // Make rapid API calls
        const promises = scores.map((score) =>
          request(app)
            .post('/scores/submit')
            .send({ score })
            .expect(201)
        );

        Promise.all(promises).catch(reject);

        // Timeout
        setTimeout(() => {
          reject(new Error(`Test timeout. Received ${notificationCount}/${numberOfCalls} notifications`));
        }, 10000);
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency between API responses and WebSocket notifications', (done) => {
      const testScore = 1750;
      const scoreData = {
        userId: sampleUser.userId,
        username: sampleUser.username,
        score: testScore,
        timestamp: new Date().toISOString(),
      };

      // Mock successful score save
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: scoreData,
      });

      // Listen for WebSocket notification
      clientSocket.on('HIGH_SCORE', (notification) => {
        // Data from WebSocket should match what was returned from API
        expect(notification.data).toEqual(scoreData);
        done();
      });

      // Submit score via API
      request(app)
        .post('/scores/submit')
        .send({ score: testScore })
        .expect(201)
        .end((err, res) => {
          if (err) {
            done(err);
            return;
          }

          // API response should match what will be sent via WebSocket
          expect(res.body.data).toEqual(scoreData);
        });
    });
  });
});
