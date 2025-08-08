import { DynamoService } from '../../src/services/dynamoService';
import { mockDynamoResponse, mockDynamoError, sampleUser, sampleScore, sampleLeaderboard } from '../utils';
import AWS from 'aws-sdk';

// Mock AWS SDK
jest.mock('aws-sdk');

const mockDocumentClient = {
  put: jest.fn(),
  get: jest.fn(),
  scan: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
};

// Mock DynamoDB DocumentClient
(AWS.DynamoDB.DocumentClient as jest.MockedClass<typeof AWS.DynamoDB.DocumentClient>).mockImplementation(
  () => mockDocumentClient as any
);

describe('DynamoService', () => {
  let dynamoService: DynamoService;

  beforeEach(() => {
    dynamoService = new DynamoService();
    jest.clearAllMocks();
  });

  describe('saveScore', () => {
    it('should save a score successfully', async () => {
      mockDocumentClient.put.mockReturnValue(mockDynamoResponse({}));

      const result = await dynamoService.saveScore(
        sampleScore.userId,
        sampleScore.username,
        sampleScore.score
      );

      expect(result.success).toBe(true);
      expect(mockDocumentClient.put).toHaveBeenCalledWith({
        TableName: 'test-leaderboard',
        Item: expect.objectContaining({
          userId: sampleScore.userId,
          username: sampleScore.username,
          score: sampleScore.score,
          timestamp: expect.any(String),
        }),
      });
    });

    it('should handle DynamoDB errors when saving score', async () => {
      const error = new Error('DynamoDB save error');
      mockDocumentClient.put.mockReturnValue(mockDynamoError(error));

      const result = await dynamoService.saveScore(
        sampleScore.userId,
        sampleScore.username,
        sampleScore.score
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('DynamoDB save error');
    });

    it('should validate score data before saving', async () => {
      mockDocumentClient.put.mockReturnValue(mockDynamoResponse({}));

      // Test with invalid score (negative)
      const result = await dynamoService.saveScore('user1', 'testuser', -100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid score value');
      expect(mockDocumentClient.put).not.toHaveBeenCalled();
    });

    it('should validate user data before saving', async () => {
      mockDocumentClient.put.mockReturnValue(mockDynamoResponse({}));

      // Test with empty userId
      const result = await dynamoService.saveScore('', 'testuser', 100);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User ID and username are required');
      expect(mockDocumentClient.put).not.toHaveBeenCalled();
    });
  });

  describe('getLeaderboard', () => {
    it('should retrieve leaderboard data successfully', async () => {
      mockDocumentClient.scan.mockReturnValue(
        mockDynamoResponse({ Items: sampleLeaderboard })
      );

      const result = await dynamoService.getLeaderboard();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(sampleLeaderboard);
      expect(mockDocumentClient.scan).toHaveBeenCalledWith({
        TableName: 'test-leaderboard',
      });
    });

    it('should limit leaderboard results', async () => {
      const limit = 5;
      mockDocumentClient.scan.mockReturnValue(
        mockDynamoResponse({ Items: sampleLeaderboard.slice(0, limit) })
      );

      const result = await dynamoService.getLeaderboard(limit);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBeLessThanOrEqual(limit);
      expect(mockDocumentClient.scan).toHaveBeenCalledWith({
        TableName: 'test-leaderboard',
        Limit: limit,
      });
    });

    it('should handle empty leaderboard', async () => {
      mockDocumentClient.scan.mockReturnValue(mockDynamoResponse({ Items: [] }));

      const result = await dynamoService.getLeaderboard();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle DynamoDB errors when retrieving leaderboard', async () => {
      const error = new Error('DynamoDB scan error');
      mockDocumentClient.scan.mockReturnValue(mockDynamoError(error));

      const result = await dynamoService.getLeaderboard();

      expect(result.success).toBe(false);
      expect(result.error).toBe('DynamoDB scan error');
    });
  });

  describe('getUserScore', () => {
    it('should retrieve user score successfully', async () => {
      const userScore = { ...sampleScore };
      mockDocumentClient.get.mockReturnValue(
        mockDynamoResponse({ Item: userScore })
      );

      const result = await dynamoService.getUserScore(userScore.userId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(userScore);
      expect(mockDocumentClient.get).toHaveBeenCalledWith({
        TableName: 'test-leaderboard',
        Key: { userId: userScore.userId },
      });
    });

    it('should handle user not found', async () => {
      mockDocumentClient.get.mockReturnValue(mockDynamoResponse({}));

      const result = await dynamoService.getUserScore('nonexistent-user');

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('should handle DynamoDB errors when retrieving user score', async () => {
      const error = new Error('DynamoDB get error');
      mockDocumentClient.get.mockReturnValue(mockDynamoError(error));

      const result = await dynamoService.getUserScore('user-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DynamoDB get error');
    });
  });

  describe('updateScore', () => {
    it('should update score if new score is higher', async () => {
      const existingScore = { ...sampleScore, score: 1000 };
      const newScore = 1500;

      mockDocumentClient.get.mockReturnValue(
        mockDynamoResponse({ Item: existingScore })
      );
      mockDocumentClient.put.mockReturnValue(mockDynamoResponse({}));

      const result = await dynamoService.updateScore(
        existingScore.userId,
        existingScore.username,
        newScore
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(mockDocumentClient.put).toHaveBeenCalled();
    });

    it('should not update score if new score is lower', async () => {
      const existingScore = { ...sampleScore, score: 1500 };
      const newScore = 1000;

      mockDocumentClient.get.mockReturnValue(
        mockDynamoResponse({ Item: existingScore })
      );

      const result = await dynamoService.updateScore(
        existingScore.userId,
        existingScore.username,
        newScore
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(mockDocumentClient.put).not.toHaveBeenCalled();
    });

    it('should create new score if user does not exist', async () => {
      const newScore = 1500;

      mockDocumentClient.get.mockReturnValue(mockDynamoResponse({}));
      mockDocumentClient.put.mockReturnValue(mockDynamoResponse({}));

      const result = await dynamoService.updateScore('new-user', 'newuser', newScore);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(mockDocumentClient.put).toHaveBeenCalled();
    });
  });

  describe('deleteUserScore', () => {
    it('should delete user score successfully', async () => {
      mockDocumentClient.delete.mockReturnValue(mockDynamoResponse({}));

      const result = await dynamoService.deleteUserScore('user-id');

      expect(result.success).toBe(true);
      expect(mockDocumentClient.delete).toHaveBeenCalledWith({
        TableName: 'test-leaderboard',
        Key: { userId: 'user-id' },
      });
    });

    it('should handle DynamoDB errors when deleting user score', async () => {
      const error = new Error('DynamoDB delete error');
      mockDocumentClient.delete.mockReturnValue(mockDynamoError(error));

      const result = await dynamoService.deleteUserScore('user-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DynamoDB delete error');
    });
  });

  describe('getTopScores', () => {
    it('should retrieve top scores with limit', async () => {
      const topScores = sampleLeaderboard.slice(0, 2);
      mockDocumentClient.scan.mockReturnValue(
        mockDynamoResponse({ Items: topScores })
      );

      const result = await dynamoService.getTopScores(2);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBeLessThanOrEqual(2);
    });

    it('should sort scores in descending order', async () => {
      const unsortedScores = [
        { userId: 'user1', username: 'user1', score: 1000, timestamp: '2025-01-01T00:00:00.000Z' },
        { userId: 'user2', username: 'user2', score: 2000, timestamp: '2025-01-01T01:00:00.000Z' },
        { userId: 'user3', username: 'user3', score: 1500, timestamp: '2025-01-01T02:00:00.000Z' },
      ];

      mockDocumentClient.scan.mockReturnValue(
        mockDynamoResponse({ Items: unsortedScores })
      );

      const result = await dynamoService.getTopScores();

      expect(result.success).toBe(true);
      expect(result.data?.[0].score).toBe(2000); // Highest score first
      expect(result.data?.[1].score).toBe(1500);
      expect(result.data?.[2].score).toBe(1000);
    });
  });
});
