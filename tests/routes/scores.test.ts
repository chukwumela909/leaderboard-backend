import request from 'supertest';
import express from 'express';
import { scoreRoutes } from '../../src/routes/scores';
import { authenticateToken } from '../../src/middleware/auth';
import { createTestToken, sampleUser, sampleScore } from '../utils';

// Mock services
jest.mock('../../src/services/dynamoService');
jest.mock('../../src/services/authService');
jest.mock('../../src/services/websocketService');

const mockDynamoService = require('../../src/services/dynamoService').DynamoService;
const mockAuthService = require('../../src/services/authService').AuthService;
const mockWebSocketService = require('../../src/services/websocketService').WebSocketService;

describe('Scores Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to always authenticate
    app.use((req: any, res, next) => {
      req.user = sampleUser;
      next();
    });
    
    app.use('/scores', scoreRoutes);
    jest.clearAllMocks();
  });

  describe('POST /scores', () => {
    it('should successfully save a new score', async () => {
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: sampleScore,
      });

      mockWebSocketService.prototype.broadcastHighScore = jest.fn();

      const scoreData = { score: 1500 };

      const response = await request(app)
        .post('/scores')
        .send(scoreData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(sampleScore);
      expect(mockDynamoService.prototype.saveScore).toHaveBeenCalledWith(
        sampleUser.userId,
        sampleUser.username,
        1500
      );
    });

    it('should broadcast high score notification for scores > 1000', async () => {
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: { ...sampleScore, score: 1500 },
      });

      const broadcastSpy = jest.fn();
      mockWebSocketService.prototype.broadcastHighScore = broadcastSpy;

      const scoreData = { score: 1500 };

      await request(app)
        .post('/scores')
        .send(scoreData)
        .expect(201);

      expect(broadcastSpy).toHaveBeenCalledWith({
        userId: sampleUser.userId,
        username: sampleUser.username,
        score: 1500,
        timestamp: expect.any(String),
      });
    });

    it('should not broadcast for scores <= 1000', async () => {
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: { ...sampleScore, score: 800 },
      });

      const broadcastSpy = jest.fn();
      mockWebSocketService.prototype.broadcastHighScore = broadcastSpy;

      const scoreData = { score: 800 };

      await request(app)
        .post('/scores')
        .send(scoreData)
        .expect(201);

      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it('should validate score input', async () => {
      const invalidScores = [
        { score: -100 }, // Negative
        { score: 'not-a-number' }, // Not a number
        { score: null }, // Null
        {}, // Missing score
      ];

      for (const invalidScore of invalidScores) {
        const response = await request(app)
          .post('/scores')
          .send(invalidScore);

        expect([400, 422]).toContain(response.status);
        expect(response.body.error).toBeDefined();
      }
    });

    it('should handle DynamoDB errors', async () => {
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      const scoreData = { score: 1500 };

      const response = await request(app)
        .post('/scores')
        .send(scoreData)
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });

    it('should handle very large scores', async () => {
      const largeScore = 999999999;
      
      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: { ...sampleScore, score: largeScore },
      });

      const scoreData = { score: largeScore };

      const response = await request(app)
        .post('/scores')
        .send(scoreData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /scores/user/:userId', () => {
    it('should retrieve user score successfully', async () => {
      mockDynamoService.prototype.getUserScore.mockResolvedValue({
        success: true,
        data: sampleScore,
      });

      const response = await request(app)
        .get(`/scores/user/${sampleUser.userId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(sampleScore);
      expect(mockDynamoService.prototype.getUserScore).toHaveBeenCalledWith(sampleUser.userId);
    });

    it('should handle user not found', async () => {
      mockDynamoService.prototype.getUserScore.mockResolvedValue({
        success: true,
        data: null,
      });

      const response = await request(app)
        .get('/scores/user/nonexistent-user')
        .expect(404);

      expect(response.body.error).toBe('User score not found');
    });

    it('should handle DynamoDB errors when retrieving user score', async () => {
      mockDynamoService.prototype.getUserScore.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      const response = await request(app)
        .get(`/scores/user/${sampleUser.userId}`)
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });

    it('should validate userId parameter', async () => {
      const response = await request(app)
        .get('/scores/user/')
        .expect(404);

      // Should return 404 for empty userId
    });
  });

  describe('PUT /scores/user/:userId', () => {
    it('should update user score successfully', async () => {
      mockDynamoService.prototype.updateScore.mockResolvedValue({
        success: true,
        updated: true,
        data: { ...sampleScore, score: 2000 },
      });

      const updateData = { score: 2000 };

      const response = await request(app)
        .put(`/scores/user/${sampleUser.userId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.updated).toBe(true);
      expect(mockDynamoService.prototype.updateScore).toHaveBeenCalledWith(
        sampleUser.userId,
        sampleUser.username,
        2000
      );
    });

    it('should handle score not updated (lower score)', async () => {
      mockDynamoService.prototype.updateScore.mockResolvedValue({
        success: true,
        updated: false,
        message: 'Score not updated - submitted score is not higher',
      });

      const updateData = { score: 500 };

      const response = await request(app)
        .put(`/scores/user/${sampleUser.userId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.updated).toBe(false);
      expect(response.body.message).toContain('not higher');
    });

    it('should validate update score input', async () => {
      const invalidUpdates = [
        { score: -500 },
        { score: 'invalid' },
        {},
      ];

      for (const invalidUpdate of invalidUpdates) {
        const response = await request(app)
          .put(`/scores/user/${sampleUser.userId}`)
          .send(invalidUpdate);

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should handle authorization for updating scores', async () => {
      // Test updating another user's score (should be allowed for admins)
      const anotherUserId = 'another-user-123';
      
      mockDynamoService.prototype.updateScore.mockResolvedValue({
        success: true,
        updated: true,
      });

      const updateData = { score: 1500 };

      const response = await request(app)
        .put(`/scores/user/${anotherUserId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /scores/user/:userId', () => {
    it('should delete user score successfully', async () => {
      mockDynamoService.prototype.deleteUserScore.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .delete(`/scores/user/${sampleUser.userId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Score deleted successfully');
      expect(mockDynamoService.prototype.deleteUserScore).toHaveBeenCalledWith(sampleUser.userId);
    });

    it('should handle DynamoDB errors when deleting score', async () => {
      mockDynamoService.prototype.deleteUserScore.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      const response = await request(app)
        .delete(`/scores/user/${sampleUser.userId}`)
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /scores/top', () => {
    it('should retrieve top scores with default limit', async () => {
      const topScores = [sampleScore];
      
      mockDynamoService.prototype.getTopScores.mockResolvedValue({
        success: true,
        data: topScores,
      });

      const response = await request(app)
        .get('/scores/top')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(topScores);
      expect(mockDynamoService.prototype.getTopScores).toHaveBeenCalledWith(10);
    });

    it('should retrieve top scores with custom limit', async () => {
      const limit = 5;
      const topScores = [sampleScore];
      
      mockDynamoService.prototype.getTopScores.mockResolvedValue({
        success: true,
        data: topScores,
      });

      const response = await request(app)
        .get(`/scores/top?limit=${limit}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDynamoService.prototype.getTopScores).toHaveBeenCalledWith(limit);
    });

    it('should validate limit parameter', async () => {
      const invalidLimits = ['invalid', '-5', '0'];

      for (const invalidLimit of invalidLimits) {
        const response = await request(app)
          .get(`/scores/top?limit=${invalidLimit}`);

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should handle maximum limit', async () => {
      const maxLimit = 100;
      
      mockDynamoService.prototype.getTopScores.mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await request(app)
        .get(`/scores/top?limit=${maxLimit + 50}`)
        .expect(200);

      // Should cap at maximum limit
      expect(mockDynamoService.prototype.getTopScores).toHaveBeenCalledWith(maxLimit);
    });
  });

  describe('Authentication middleware', () => {
    beforeEach(() => {
      // Create app without mocked auth for these tests
      app = express();
      app.use(express.json());
      app.use('/scores', scoreRoutes);
    });

    it('should require authentication for POST /scores', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const response = await request(app)
        .post('/scores')
        .send({ score: 1500 })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should allow authenticated requests', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        success: true,
        user: sampleUser,
      });

      mockDynamoService.prototype.saveScore.mockResolvedValue({
        success: true,
        data: sampleScore,
      });

      const token = createTestToken(sampleUser);

      const response = await request(app)
        .post('/scores')
        .set('Authorization', `Bearer ${token}`)
        .send({ score: 1500 })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});
