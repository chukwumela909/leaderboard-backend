export const TEST_JWT_SECRET = 'test-secret-key-for-testing';

export const createTestToken = (payload: string | object, expiresIn: string = '1h'): string => {
  // Using require to avoid TypeScript issues in tests
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn });
};

export const createExpiredToken = (payload: string | object): string => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1h' });
};

export const mockDynamoResponse = (data: any) => ({
  promise: jest.fn().mockResolvedValue(data),
});

export const mockDynamoError = (error: Error) => ({
  promise: jest.fn().mockRejectedValue(error),
});

export const sampleUser = {
  userId: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
};

export const sampleScore = {
  userId: 'test-user-123',
  username: 'testuser',
  score: 1500,
  timestamp: new Date().toISOString(),
};

export const sampleLeaderboard = [
  {
    userId: 'user-1',
    username: 'player1',
    score: 2000,
    timestamp: '2025-01-01T00:00:00.000Z',
  },
  {
    userId: 'user-2',
    username: 'player2',
    score: 1500,
    timestamp: '2025-01-01T01:00:00.000Z',
  },
  {
    userId: 'user-3',
    username: 'player3',
    score: 1000,
    timestamp: '2025-01-01T02:00:00.000Z',
  },
];

export const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const createMockSocket = () => ({
  id: 'mock-socket-id',
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  broadcast: {
    emit: jest.fn(),
  },
  to: jest.fn().mockReturnThis(),
});

export const createMockIo = () => ({
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  sockets: {
    sockets: new Map(),
  },
  on: jest.fn(),
});
