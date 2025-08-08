import request from 'supertest';
import express from 'express';
import { leaderboardRoutes } from '../../src/routes/leaderboard';
import { sampleLeaderboard, sampleUser } from '../utils';

// Mock services
jest.mock('../../src/services/dynamoService');
const mockDynamoService = require('../../src/services/dynamoService').DynamoService;

describe('Leaderboard Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/leaderboard', leaderboardRoutes);
    jest.clearAllMocks();
  });

  describe('GET /leaderboard', () => {
    it('should retrieve leaderboard successfully', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: sampleLeaderboard,
      });

      const response = await request(app)
        .get('/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(sampleLeaderboard);
      expect(mockDynamoService.prototype.getLeaderboard).toHaveBeenCalledWith(undefined);
    });

    it('should retrieve leaderboard with custom limit', async () => {
      const limit = 5;
      const limitedLeaderboard = sampleLeaderboard.slice(0, limit);
      
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: limitedLeaderboard,
      });

      const response = await request(app)
        .get(`/leaderboard?limit=${limit}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(limitedLeaderboard);
      expect(mockDynamoService.prototype.getLeaderboard).toHaveBeenCalledWith(limit);
    });

    it('should handle invalid limit parameter', async () => {
      const invalidLimits = ['invalid', '-5', '0', '101']; // Assuming max limit is 100

      for (const invalidLimit of invalidLimits) {
        const response = await request(app)
          .get(`/leaderboard?limit=${invalidLimit}`);

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should handle DynamoDB errors', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      const response = await request(app)
        .get('/leaderboard')
        .expect(500);

      expect(response.body.error).toBe('Database connection failed');
    });

    it('should handle empty leaderboard', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await request(app)
        .get('/leaderboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should validate limit parameter bounds', async () => {
      const maxLimit = 100;
      
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: sampleLeaderboard,
      });

      // Test exceeding maximum limit
      const response = await request(app)
        .get(`/leaderboard?limit=${maxLimit + 50}`)
        .expect(200);

      // Should use maximum allowed limit
      expect(mockDynamoService.prototype.getLeaderboard).toHaveBeenCalledWith(maxLimit);
    });
  });

  describe('GET /leaderboard/top/:count', () => {
    it('should retrieve top N scores', async () => {
      const count = 3;
      const topScores = sampleLeaderboard.slice(0, count);
      
      mockDynamoService.prototype.getTopScores.mockResolvedValue({
        success: true,
        data: topScores,
      });

      const response = await request(app)
        .get(`/leaderboard/top/${count}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(topScores);
      expect(mockDynamoService.prototype.getTopScores).toHaveBeenCalledWith(count);
    });

    it('should validate count parameter', async () => {
      const invalidCounts = ['invalid', '0', '-5'];

      for (const invalidCount of invalidCounts) {
        const response = await request(app)
          .get(`/leaderboard/top/${invalidCount}`);

        expect([400, 422]).toContain(response.status);
      }
    });

    it('should handle maximum count limit', async () => {
      const maxCount = 50; // Assuming maximum count is 50
      
      mockDynamoService.prototype.getTopScores.mockResolvedValue({
        success: true,
        data: sampleLeaderboard,
      });

      const response = await request(app)
        .get(`/leaderboard/top/${maxCount + 10}`)
        .expect(200);

      // Should cap at maximum count
      expect(mockDynamoService.prototype.getTopScores).toHaveBeenCalledWith(maxCount);
    });

    it('should handle DynamoDB errors when getting top scores', async () => {
      mockDynamoService.prototype.getTopScores.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      const response = await request(app)
        .get('/leaderboard/top/10')
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /leaderboard/user/:userId/rank', () => {
    it('should retrieve user rank successfully', async () => {
      // Mock getting all scores to calculate rank
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: sampleLeaderboard,
      });

      const userId = sampleLeaderboard[1].userId; // Second place user
      
      const response = await request(app)
        .get(`/leaderboard/user/${userId}/rank`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.rank).toBe(2); // Should be second place
      expect(response.body.totalPlayers).toBe(sampleLeaderboard.length);
    });

    it('should handle user not found in leaderboard', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: sampleLeaderboard,
      });

      const response = await request(app)
        .get('/leaderboard/user/nonexistent-user/rank')
        .expect(404);

      expect(response.body.error).toBe('User not found in leaderboard');
    });

    it('should handle empty leaderboard when checking rank', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await request(app)
        .get(`/leaderboard/user/${sampleUser.userId}/rank`)
        .expect(404);

      expect(response.body.error).toBe('User not found in leaderboard');
    });

    it('should handle DynamoDB errors when checking rank', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      const response = await request(app)
        .get(`/leaderboard/user/${sampleUser.userId}/rank`)
        .expect(500);

      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /leaderboard/stats', () => {
    it('should retrieve leaderboard statistics', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: sampleLeaderboard,
      });

      const response = await request(app)
        .get('/leaderboard/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual({
        totalPlayers: sampleLeaderboard.length,
        highestScore: Math.max(...sampleLeaderboard.map(p => p.score)),
        averageScore: expect.any(Number),
        lastUpdated: expect.any(String),
      });
    });

    it('should handle empty leaderboard stats', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: [],
      });

      const response = await request(app)
        .get('/leaderboard/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual({
        totalPlayers: 0,
        highestScore: 0,
        averageScore: 0,
        lastUpdated: expect.any(String),
      });
    });

    it('should calculate correct statistics', async () => {
      const testData = [
        { userId: '1', username: 'user1', score: 1000, timestamp: '2025-01-01T00:00:00.000Z' },
        { userId: '2', username: 'user2', score: 2000, timestamp: '2025-01-01T01:00:00.000Z' },
        { userId: '3', username: 'user3', score: 3000, timestamp: '2025-01-01T02:00:00.000Z' },
      ];

      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: testData,
      });

      const response = await request(app)
        .get('/leaderboard/stats')
        .expect(200);

      expect(response.body.stats.totalPlayers).toBe(3);
      expect(response.body.stats.highestScore).toBe(3000);
      expect(response.body.stats.averageScore).toBe(2000); // (1000 + 2000 + 3000) / 3
    });
  });

  describe('Response formatting', () => {
    it('should return data in correct format', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: sampleLeaderboard,
      });

      const response = await request(app)
        .get('/leaderboard')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // Check each leaderboard entry has required fields
      response.body.data.forEach((entry: any) => {
        expect(entry).toHaveProperty('userId');
        expect(entry).toHaveProperty('username');
        expect(entry).toHaveProperty('score');
        expect(entry).toHaveProperty('timestamp');
      });
    });

    it('should sort leaderboard by score descending', async () => {
      const unsortedData = [
        { userId: '1', username: 'user1', score: 1500, timestamp: '2025-01-01T00:00:00.000Z' },
        { userId: '2', username: 'user2', score: 2500, timestamp: '2025-01-01T01:00:00.000Z' },
        { userId: '3', username: 'user3', score: 1000, timestamp: '2025-01-01T02:00:00.000Z' },
      ];

      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: true,
        data: unsortedData,
      });

      const response = await request(app)
        .get('/leaderboard')
        .expect(200);

      const scores = response.body.data.map((entry: any) => entry.score);
      const sortedScores = [...scores].sort((a, b) => b - a);
      
      expect(scores).toEqual(sortedScores);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed requests gracefully', async () => {
      // Test with various malformed parameters
      const malformedRequests = [
        '/leaderboard?limit=abc',
        '/leaderboard/top/xyz',
        '/leaderboard/user//rank',
      ];

      for (const url of malformedRequests) {
        const response = await request(app).get(url);
        expect([400, 404, 422]).toContain(response.status);
      }
    });

    it('should handle database timeout errors', async () => {
      mockDynamoService.prototype.getLeaderboard.mockResolvedValue({
        success: false,
        error: 'Request timeout',
      });

      const response = await request(app)
        .get('/leaderboard')
        .expect(500);

      expect(response.body.error).toBe('Request timeout');
    });

    it('should handle unexpected errors', async () => {
      mockDynamoService.prototype.getLeaderboard.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/leaderboard')
        .expect(500);

      expect(response.body.error).toBeDefined();
    });
  });
});
