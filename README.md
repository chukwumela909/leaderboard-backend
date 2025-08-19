# Leaderboard Backend API

A comprehensive real-time leaderboard system built with Node.js, TypeScript, AWS Cognito authentication, DynamoDB storage, and WebSocket notifications. Designed for AWS Lambda deployment with local development support.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- AWS CLI configured (for deployment)
- AWS Cognito User Pool and DynamoDB table (for production)

### 1. Install Dependencies
```bash
cd leaderboard-backend
npm install
```

### 2. Environment Setup
```bash
# Copy the example file (create one if it doesn't exist)
cp .env.example .env

# Edit .env with your values:
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_CLIENT_ID=your-client-id
DYNAMODB_TABLE=your-table-name
AWS_REGION=us-east-1
JWT_SECRET=your-jwt-secret
```

### 3. Local Development
```bash
# Start development server with hot reload
npm run dev

# Server runs on http://localhost:3001
# API endpoints available at http://localhost:3001/api/*
# Health check: http://localhost:3001/health
```

### 4. Build and Deploy
```bash
# Build TypeScript
npm run build

# Deploy to development
npm run deploy

# Deploy to production
npm run deploy:prod

# Clean build files
npm run clean
```

## 🏗️ Architecture & Service Structure

### High-Level Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  Express Server  │───▶│   AWS Services  │
│  (Frontend)     │    │  (Node.js/TS)    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   WebSocket      │    │   DynamoDB      │
                       │  Notifications   │    │   Cognito       │
                       └──────────────────┘    └─────────────────┘
```

### Service Layer Architecture

#### 1. Authentication Service (`authService.ts`)
**Purpose**: Handles all AWS Cognito operations
**Pattern**: Static methods (stateless operations)
```typescript
class AuthService {
  static async signUp(data)     // User registration
  static async signIn(data)     // User login
  static async confirmSignUp() // Email verification
  static async verifyToken()   // JWT validation
}
```

#### 2. DynamoDB Service (`dynamoService.ts`)
**Purpose**: All database operations for scores and users
**Pattern**: Static methods with AWS SDK v3
```typescript
class DynamoService {
  static async submitScore()    // Store user scores
  static async getLeaderboard() // Fetch top scores
  static async getUserScore()   // Get personal best
  static async getTopScores()   // Flexible top N fetch
}


### Route Layer Structure

#### 1. Authentication Routes (`routes/auth.ts`)
- `POST /api/auth/register` - User registration with validation
- `POST /api/auth/confirm` - Email confirmation
- `POST /api/auth/login` - User authentication
- `POST /api/auth/verify` - Token validation

#### 2. Score Routes (`routes/scores.ts`)
- `POST /api/scores/submit` - Protected score submission
- `GET /api/scores/my-score` - Personal best retrieval

#### 3. Leaderboard Routes (`routes/leaderboard.ts`)
- `GET /api/leaderboard/top` - Public top score
- `GET /api/leaderboard/top/:limit` - Configurable top N scores

### Middleware Architecture

#### Authentication Middleware (`middleware/auth.ts`)
- JWT token validation
- Cognito token verification
- User context injection
- Error handling for unauthorized access

### Type System (`types/index.ts`)
**Purpose**: Centralized TypeScript interfaces
```typescript
interface User {
  userId: string;
  email: string;
  username: string;
}

interface ScoreEntry {
  userId: string;
  username: string;
  score: number;
  timestamp: string;
}

interface LeaderboardEntry extends ScoreEntry {
  rank?: number;
}
```

## 🎯 Architectural Decisions & Rationale

### 1. **Static Service Methods**
**Choice**: All services use static methods instead of instances
**Rationale**: 
- Stateless operations ideal for Lambda functions
- No need for dependency injection complexity
- Cleaner imports and usage: `DynamoService.submitScore()`
- Better performance in serverless environments

### 2. **AWS SDK v3 with DynamoDB Document Client**
**Choice**: Modern AWS SDK with high-level document operations
**Rationale**:
- Better TypeScript support
- Simplified DynamoDB operations
- Tree-shaking for smaller Lambda bundles
- Native async/await support

### 3. **Express.js with TypeScript**
**Choice**: Express framework with full TypeScript
**Rationale**:
- Familiar and well-documented
- Excellent middleware ecosystem
- AWS Lambda compatibility via serverless-http

### 4. **Single-Table DynamoDB Design**
**Choice**: One table for all score and user data
**Rationale**:
- Cost-effective for small to medium scale
- Simplified schema management
- Efficient queries with GSI
- Follows DynamoDB best practices

### 5. **JWT + Cognito Hybrid Authentication**
**Choice**: Cognito for user management, JWT for API authentication
**Rationale**:
- Leverages AWS managed authentication
- Flexible token validation
- Offline token verification capability
- Scalable user management



### 7. **Serverless-First Design**
**Choice**: Built for AWS Lambda deployment
**Rationale**:
- Cost-effective scaling
- Zero server management
- Built-in high availability
- Pay-per-request pricing model

## 📁 Project Structure

```
leaderboard-backend/
├── src/                        # Source code
│   ├── app.ts                 # Main Express application setup
│   ├── server.ts              # Serverless Lambda handler
│   ├── local.ts               # Local development server
│   ├── middleware/            # Express middleware
│   │   └── auth.ts           # JWT authentication middleware
│   ├── routes/               # API route handlers
│   │   ├── auth.ts          # Authentication endpoints
│   │   ├── scores.ts        # Score management endpoints
│   │   └── leaderboard.ts   # Leaderboard endpoints
│   ├── services/            # Business logic layer
│   │   ├── authService.ts   # AWS Cognito operations
│   │   ├── dynamoService.ts # DynamoDB operations
│   │   └── websocketService.ts # Real-time notifications
│   └── types/               # TypeScript type definitions
│       └── index.ts         # Shared interfaces and types
├── serverless.yml          # Serverless Framework configuration
├── tsconfig.json          # TypeScript compiler configuration
├── package.json           # Dependencies and npm scripts
├── .env.example           # Environment variables template
└── API_DOCUMENTATION.md   # Detailed API documentation
```

## 📡 API Endpoints

### Authentication Endpoints
- `POST /api/auth/register` - Register new user with email verification
- `POST /api/auth/confirm` - Confirm email with verification code
- `POST /api/auth/login` - Authenticate user and get JWT token
- `POST /api/auth/verify` - Validate JWT token

### Score Management (Protected)
- `POST /api/scores/submit` - Submit user score (requires authentication)
- `GET /api/scores/my-score` - Get personal best score

### Leaderboard (Public)
- `GET /api/leaderboard/top` - Get top score (rank #1)
- `GET /api/leaderboard/top/:limit` - Get top N scores (configurable)

### System Endpoints
- `GET /health` - Health check and system status

## 🔄 WebSocket Events

### Client → Server
- `connection` - Client connects to WebSocket server
- `disconnect` - Client disconnects

### Server → Client
- `highScore` - Notification when user achieves score > 1000
- `leaderboardUpdate` - Real-time leaderboard updates
- `newPlayer` - Welcome message for new player registration

## 🔧 Development Workflow

### Local Development Setup
1. **Start Development Server**:
   ```bash
   npm run dev
   # Server: http://localhost:3001
   # WebSocket: ws://localhost:3001
   ```

2. **API Testing**:
   ```bash
   # Health check
   curl http://localhost:3001/health
   
   # Register user
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!","username":"testuser"}'
   ```

### Build and Deployment
```bash
# Local build verification
npm run build

# Deploy to AWS
npm run deploy              # Development environment
npm run deploy:prod         # Production environment

# Cleanup
npm run clean              # Remove build artifacts
```

## 💡 Example Usage & Workflows

### Complete User Registration Flow
```bash
# 1. Register new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "password": "SecurePass123!",
    "username": "ProGamer"
  }'

# 2. Confirm email (check email for verification code)
curl -X POST http://localhost:3001/api/auth/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "confirmationCode": "123456"
  }'

# 3. Sign in to get access token
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "player@example.com",
    "password": "SecurePass123!"
  }'

# Response includes: { "accessToken": "eyJ...", "user": {...} }
```

### Score Submission and Leaderboard
```bash
# 4. Submit high score (use accessToken from login)
curl -X POST http://localhost:3001/api/scores/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "score": 2500
  }'

# 5. Check personal best
curl -X GET http://localhost:3001/api/scores/my-score \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"

# 6. View leaderboard (public endpoint)
curl http://localhost:3001/api/leaderboard/top/10
```

### WebSocket Real-Time Events
```javascript
// Client-side WebSocket connection
const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected to leaderboard server');
});

socket.on('highScore', (data) => {
  console.log('High score achieved!', data);
  // { userId, username, score, timestamp }
});

socket.on('leaderboardUpdate', (data) => {
  console.log('Leaderboard updated:', data);
  // Updated top scores array
});

socket.on('newPlayer', (data) => {
  console.log('New player joined:', data);
  // { username, timestamp }
});
```

## 🛠️ Configuration & Environment

### Required Environment Variables
```bash
# AWS Cognito Configuration
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx    # Your Cognito User Pool ID
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxx        # Your Cognito App Client ID

# Database Configuration
DYNAMODB_TABLE=leaderboard-scores            # DynamoDB table name
AWS_REGION=us-east-1                        # AWS region

# Security
JWT_SECRET=your-super-secure-secret-key      # JWT signing secret

# Optional: Local development overrides
PORT=3001                                    # Local server port
NODE_ENV=development                         # Environment mode
```

### AWS Cognito Setup Requirements
1. **Create User Pool** with email verification
2. **Configure App Client** with these settings:
   - ✅ ALLOW_USER_PASSWORD_AUTH
   - ✅ ALLOW_REFRESH_TOKEN_AUTH
   - ✅ Email verification required
3. **Set up email delivery** (SES or Cognito default)

### DynamoDB Table Schema
```json
{
  "TableName": "leaderboard-scores",
  "KeySchema": [
    {
      "AttributeName": "userId",
      "KeyType": "HASH"
    }
  ],
  "AttributeDefinitions": [
    {
      "AttributeName": "userId",
      "AttributeType": "S"
    },
    {
      "AttributeName": "score",
      "AttributeType": "N"
    }
  ],
  "GlobalSecondaryIndexes": [
    {
      "IndexName": "ScoreIndex",
      "KeySchema": [
        {
          "AttributeName": "score",
          "KeyType": "HASH"
        }
      ],
      "Projection": {
        "ProjectionType": "ALL"
      }
    }
  ]
}
```

## 🔍 Monitoring & Debugging

### Health Check Monitoring
```bash
# Basic health check
curl http://localhost:3001/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-08-08T12:00:00.000Z",
  "services": {
    "database": "connected",
    "authentication": "configured",
    "websocket": "active"
  }
}
```

### Common Development Issues

#### 1. Cognito Authentication Errors
```bash
# Verify Cognito configuration
npm run test:unit -- --grep "AuthService"

# Check environment variables
echo $COGNITO_USER_POOL_ID
echo $COGNITO_CLIENT_ID
```

#### 2. DynamoDB Connection Issues
```bash
# Test database connectivity
npm run test:unit -- --grep "DynamoService"

# Verify AWS credentials
aws sts get-caller-identity
```

#### 3. WebSocket Connection Problems
```bash
# Test WebSocket functionality
npm run test:integration -- --grep "WebSocket"

# Open test page in browser
open websocket-test.html
```

## 🚀 Deployment Guide

### Serverless Framework Deployment
```bash
# Install Serverless CLI globally
npm install -g serverless

# Deploy to development
npm run deploy

# Deploy to production
npm run deploy:prod

# View deployment info
serverless info

# View logs
serverless logs -f api
```

### AWS Lambda Considerations
- **Cold start optimization**: Services use static methods
- **Memory allocation**: Configured for 512MB (adjustable)
- **Timeout**: Set to 30 seconds for API operations
- **Environment variables**: Automatically injected from serverless.yml

### Production Checklist
- [ ] Cognito User Pool configured with proper security settings
- [ ] DynamoDB table created with appropriate read/write capacity
- [ ] Environment variables set in AWS Lambda
- [ ] API Gateway custom domain configured (optional)
- [ ] CloudWatch monitoring enabled
- [ ] Security groups and IAM roles properly configured

## 📚 Additional Documentation

- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)**: Complete API reference

## 🤝 Contributing

1. **Development Setup**: Follow quick start guide
2. **Testing**: Ensure all tests pass before submitting
3. **Code Style**: TypeScript with strict mode enabled
4. **Documentation**: Update README for any architectural changes

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.