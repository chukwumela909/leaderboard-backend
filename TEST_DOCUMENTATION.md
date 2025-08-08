# Testing Documentation

This document describes the comprehensive test suite for the Leaderboard Backend application.

## Test Structure

```
tests/
├── setup.ts                           # Global test setup and utilities
├── utils.ts                          # Test helper functions and mocks
├── services/                         # Service layer tests
│   ├── authService.test.ts           # Authentication service tests
│   ├── dynamoService.test.ts         # DynamoDB service tests
│   └── websocketService.test.ts      # WebSocket service tests
├── routes/                           # API route tests
│   ├── auth.test.ts                  # Authentication routes
│   ├── scores.test.ts                # Score management routes
│   └── leaderboard.test.ts           # Leaderboard routes
└── integration/                      # Integration tests
    ├── websocket.test.ts             # WebSocket integration tests
    └── api-websocket.test.ts         # End-to-end API + WebSocket tests
```

## Test Categories

### 1. Unit Tests

#### Service Tests (`tests/services/`)

**AuthService Tests** (`authService.test.ts`)
- User registration (signUp)
- User authentication (signIn)
- Email confirmation (confirmSignUp)
- Token verification and user extraction
- Error handling for invalid credentials
- Input validation

**DynamoService Tests** (`dynamoService.test.ts`)
- Score saving and validation
- Leaderboard retrieval with pagination
- User score queries
- Score updates (only higher scores)
- User score deletion
- Top scores retrieval with sorting
- Database error handling

**WebSocketService Tests** (`websocketService.test.ts`)
- WebSocket server initialization
- Connection handling and event setup
- High score broadcasts (scores > 1000)
- Leaderboard update broadcasts
- New player notifications
- Custom notification system
- Client connection tracking
- Room management (join/leave leaderboard)
- Error handling for invalid data

#### Route Tests (`tests/routes/`)

**Auth Routes** (`auth.test.ts`)
- POST `/auth/signup` - User registration
- POST `/auth/signin` - User login
- POST `/auth/confirm` - Email verification
- POST `/auth/verify` - Token validation
- Input validation (email format, password strength)
- Rate limiting behavior
- Error handling for various scenarios

**Score Routes** (`scores.test.ts`)
- POST `/scores/submit` - Score submission with real-time notifications
- GET `/scores/user/:userId` - User score retrieval
- PUT `/scores/user/:userId` - Score updates
- DELETE `/scores/user/:userId` - Score deletion
- GET `/scores/top` - Top scores with pagination
- Authentication middleware testing
- Input validation and error handling

**Leaderboard Routes** (`leaderboard.test.ts`)
- GET `/leaderboard` - Full leaderboard with pagination
- GET `/leaderboard/top/:count` - Top N scores
- GET `/leaderboard/user/:userId/rank` - User ranking
- GET `/leaderboard/stats` - Leaderboard statistics
- Response formatting and data sorting
- Error handling and edge cases

### 2. Integration Tests

#### WebSocket Integration (`websocket.test.ts`)
- Real WebSocket server and client connections
- Connection lifecycle (connect, welcome, disconnect)
- Event handling (ping/pong, join/leave rooms)
- Broadcast functionality to multiple clients
- Room management and selective broadcasting
- Performance under load
- Error handling and graceful disconnection

#### API + WebSocket End-to-End (`api-websocket.test.ts`)
- Complete workflow: API calls triggering WebSocket notifications
- Score submission with real-time high score notifications
- Leaderboard updates with live broadcasting
- Concurrent operations and data consistency
- Error scenarios (API failures with active WebSocket)
- Performance testing with multiple rapid operations

## Test Utilities

### Test Setup (`setup.ts`)
- Mock environment variables
- DynamoDB mock configuration
- Custom Jest matchers (JWT validation)
- Global cleanup functions

### Test Utils (`utils.ts`)
- JWT token creation helpers
- Mock data generators (users, scores, leaderboard)
- DynamoDB response mocking utilities
- Socket.IO mock objects
- Utility functions (delays, mock clients)

## Running Tests

### Basic Test Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

### Specific Test Categories

```bash
# Run only unit tests (services and routes)
npm run test:unit

# Run only integration tests
npm run test:integration

# Run specific test file
npx jest tests/services/authService.test.ts

# Run tests matching a pattern
npx jest --testNamePattern="should handle authentication"
```

### Coverage Reports

After running `npm run test:coverage`, check:
- `coverage/` directory for detailed HTML reports
- Terminal output for coverage summary
- Focus on maintaining >80% coverage across all modules

## Test Features

### Mocking Strategy
- **AWS Services**: Comprehensive mocking of Cognito and DynamoDB
- **WebSocket**: Real WebSocket connections for integration tests
- **HTTP Requests**: SuperTest for API endpoint testing
- **Time**: Controllable timestamps in test data

### Real-time Testing
- Actual WebSocket server instances for integration tests
- Multiple client connections for broadcast testing
- Event timing and ordering verification
- Performance testing under concurrent load

### Error Simulation
- Database connection failures
- Authentication errors
- Network timeouts
- Invalid input data
- Malformed requests

### Data Validation
- Input sanitization testing
- Business rule enforcement (score thresholds)
- Data consistency between API and WebSocket
- Edge cases (empty data, large numbers, special characters)

## Test Data

### Sample Users
```typescript
const sampleUser = {
  userId: 'test-user-123',
  username: 'testuser',
  email: 'test@example.com',
};
```

### Sample Scores
```typescript
const sampleScore = {
  userId: 'test-user-123',
  username: 'testuser',
  score: 1500,
  timestamp: '2025-01-01T00:00:00.000Z',
};
```

### Sample Leaderboard
- Pre-defined sorted leaderboard data
- Multiple users with varying scores
- Consistent timestamps for testing

## Best Practices

### Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain the expected behavior
- Include both positive and negative test cases
- Test edge cases and boundary conditions

### Async Testing
- Proper handling of promises and async/await
- Timeout configuration for long-running tests
- Event-driven testing with proper cleanup

### Mock Management
- Clear mocks between tests to avoid interference
- Use specific mock implementations per test when needed
- Verify mock calls to ensure correct service interaction

### Performance Considerations
- Integration tests may take longer due to real connections
- Use appropriate timeouts for WebSocket operations
- Clean up resources (connections, servers) after tests

## Continuous Integration

The test suite is designed to run in CI/CD environments:
- No external dependencies required
- Deterministic test results
- Proper resource cleanup
- Comprehensive error reporting
- Coverage reporting integration

## Debugging Tests

### Common Issues
1. **WebSocket Connection Timeouts**: Increase timeout values in test configuration
2. **Mock Interference**: Ensure `jest.clearAllMocks()` is called between tests
3. **Async Race Conditions**: Use proper `await` patterns and event listeners
4. **Port Conflicts**: Tests create servers on random ports to avoid conflicts

### Debug Commands
```bash
# Run with debug output
DEBUG=* npm test

# Run single test with verbose logging
npx jest --verbose --no-coverage tests/specific-test.test.ts

# Run with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

This comprehensive test suite ensures the reliability, performance, and correctness of the leaderboard backend system across all its components and integration points.
