// Mock environment variables
process.env.DYNAMODB_TABLE = 'test-leaderboard';
process.env.AWS_REGION = 'us-east-1';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_testpoolid';
process.env.COGNITO_CLIENT_ID = 'test-client-id';

// Mock AWS SDK DynamoDB
jest.mock('@aws-sdk/lib-dynamodb', () => {
  return {
    DynamoDBDocumentClient: {
      from: jest.fn(() => ({
        send: jest.fn(),
      })),
    },
    QueryCommand: jest.fn(),
    ScanCommand: jest.fn(),
    PutCommand: jest.fn(),
    GetCommand: jest.fn(),
    DeleteCommand: jest.fn(),
    UpdateCommand: jest.fn(),
  };
});

// Mock Cognito JWT Verifier
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(() => ({
      verify: jest.fn(),
    })),
  },
}));

// Mock Socket.IO
jest.mock('socket.io', () => {
  const mockServer = {
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    sockets: {
      sockets: new Map(),
    },
  };
  
  return {
    Server: jest.fn(() => mockServer),
  };
});

// Custom matcher for JWT validation
expect.extend({
  toBeValidJWT(received: string) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid JWT`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid JWT`,
        pass: false,
      };
    }
  },
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

export {};
