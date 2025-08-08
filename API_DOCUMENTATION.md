# 🏆 Leaderboard API Documentation

Complete API reference for the AWS Serverless Leaderboard Backend with real-time WebSocket support.

## 📋 Table of Contents

- [Base Configuration](#base-configuration)
- [Authentication](#authentication)
- [Score Management](#score-management)
- [Leaderboard](#leaderboard)
- [WebSocket Real-time Events](#websocket-real-time-events)
- [Error Handling](#error-handling)
- [TypeScript Types](#typescript-types)
- [Integration Examples](#integration-examples)

---

## 🔧 Base Configuration

### Server Endpoints
- **Production**: `https://your-api-gateway-url.amazonaws.com/prod`
- **Development (Serverless)**: `http://localhost:3001/dev`
- **Development (WebSocket)**: `http://localhost:3002`

### Headers
All API requests should include:
```typescript
headers: {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${accessToken}` // For protected routes
}
```

---

## 🔐 Authentication

### 1. Register User
**Endpoint**: `POST /api/auth/register`

```typescript
// Request
interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

// Response
interface RegisterResponse {
  message: string;
  userSub: string;
}
```

**Example**:
```typescript
const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'player@example.com',
    password: 'SecurePass123!',
    username: 'PlayerOne'
  })
});
```

### 2. Confirm Email
**Endpoint**: `POST /api/auth/confirm`

```typescript
// Request
interface ConfirmRequest {
  email: string;
  confirmationCode: string;
}

// Response
interface ConfirmResponse {
  message: string;
}
```

### 3. Sign In
**Endpoint**: `POST /api/auth/login`

```typescript
// Request
interface LoginRequest {
  email: string;
  password: string;
}

// Response
interface LoginResponse {
  message: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
  };
  expiresIn: number;
}
```

### 4. Verify Token
**Endpoint**: `POST /api/auth/verify`

```typescript
// Headers
Authorization: Bearer <access_token>

// Response
interface VerifyResponse {
  message: string;
  user: {
    userId: string;
    email: string;
    username: string;
  };
}
```

### 5. Get User Profile
**Endpoint**: `GET /api/auth/profile` 🔒

```typescript
// Response
interface UserProfileResponse {
  user: {
    userId: string;
    email: string;
    username: string;
  };
  gameStats: {
    currentScore: number;
    lastPlayed: string | null;
    rank: number | null;
    totalPlayers: number;
  };
}
```

---

## 🎯 Score Management

### 1. Submit Score
**Endpoint**: `POST /api/scores/submit` 🔒

```typescript
// Request
interface ScoreSubmissionRequest {
  score: number; // Must be >= 0 and <= 1,000,000
}

// Response
interface ScoreSubmissionResponse {
  message: string;
  isFirstScore: boolean;
  score: number;
  notificationSent: boolean; // true if score > 1000
}

// Error Response (if already submitted)
interface ScoreSubmissionError {
  error: string;
  alreadySubmitted: boolean;
  message: string;
}
```

**Business Rules**:
- ✅ Each user can only submit **one score**
- ✅ Score must be between 0 and 1,000,000
- ✅ Scores > 1000 trigger WebSocket notifications
- ✅ Real-time leaderboard updates sent to all clients

### 2. Check Submission Status
**Endpoint**: `GET /api/scores/can-submit` 🔒

```typescript
// Response
interface CanSubmitResponse {
  canSubmit: boolean;
  hasSubmitted: boolean;
  currentScore: number | null;
}
```

### 3. Get Personal Score
**Endpoint**: `GET /api/scores/my-score` 🔒

```typescript
// Response
interface MyScoreResponse {
  score: {
    score: number;
    timestamp: string;
    username: string;
  } | null;
  message?: string;
}
```

---

## 🏆 Leaderboard

### 1. Get Top Score
**Endpoint**: `GET /api/leaderboard/top` 🌐

```typescript
// Response
interface LeaderboardResponse {
  topScore: {
    username: string;
    score: number;
    timestamp: string;
  } | null;
  message?: string;
}
```

### 2. Get Top N Scores
**Endpoint**: `GET /api/leaderboard/top/:limit` 🌐

**Parameters**:
- `limit`: Number (1-100) - Number of top scores to return

```typescript
// Response
interface TopScoresResponse {
  topScores: Array<{
    username: string;
    score: number;
    timestamp: string;
  }>;
  count: number;
}
```

### 3. WebSocket Statistics
**Endpoint**: `GET /api/leaderboard/ws/stats` 🌐

```typescript
// Response
interface WebSocketStatsResponse {
  websocket: {
    connectedClients: number;
    isInitialized: boolean;
  };
  timestamp: string;
}
```

### 4. Test WebSocket Notification
**Endpoint**: `POST /api/leaderboard/ws/test-notification` 🌐

```typescript
// Request
interface TestNotificationRequest {
  message: string;
  type?: 'TEST' | 'HIGH_SCORE' | 'NEW_PLAYER';
}

// Response
interface TestNotificationResponse {
  success: boolean;
  message: string;
  connectedClients: number;
}
```

---

## ⚡ WebSocket Real-time Events

### Connection
```typescript
import io from 'socket.io-client';

const socket = io('http://localhost:3002'); // Development
// const socket = io('wss://your-websocket-endpoint'); // Production
```

### Event Types

#### 1. Connection Events
```typescript
socket.on('connect', () => {
  console.log('Connected to leaderboard WebSocket');
});

socket.on('disconnect', () => {
  console.log('Disconnected from leaderboard WebSocket');
});

socket.on('welcome', (data) => {
  console.log('Welcome message:', data.message);
});
```

#### 2. High Score Notifications
```typescript
socket.on('high_score', (data) => {
  // Triggered when someone scores > 1000
  console.log(`🎉 ${data.message}`);
  // Example: "🎉 PlayerOne achieved a high score of 1,250!"
  
  interface HighScoreEvent {
    type: 'HIGH_SCORE';
    message: string;
    score: number;
    username: string;
    timestamp: string;
  }
});
```

#### 3. New Player Notifications
```typescript
socket.on('new_player', (data) => {
  // Triggered when someone joins the leaderboard
  console.log(`👋 ${data.message}`);
  // Example: "👋 PlayerTwo joined the leaderboard!"
  
  interface NewPlayerEvent {
    type: 'NEW_PLAYER';
    message: string;
    username: string;
    timestamp: string;
  }
});
```

#### 4. Real-time Leaderboard Updates
```typescript
socket.on('leaderboard_update', (data) => {
  // Triggered whenever someone submits a score
  updateLeaderboardUI(data.topScores);
  
  interface LeaderboardUpdateEvent {
    type: 'LEADERBOARD_UPDATE';
    topScores: Array<{
      username: string;
      score: number;
      timestamp: string;
    }>;
    timestamp: string;
  }
});
```

#### 5. General Notifications
```typescript
socket.on('notification', (data) => {
  // General notification events
  interface NotificationEvent {
    type: string;
    message: string;
    timestamp: string;
    [key: string]: any;
  }
});
```

### Client Actions
```typescript
// Request current leaderboard data
socket.emit('request_leaderboard');

// Ping server for connection health
socket.emit('ping');
socket.on('pong', (data) => {
  console.log('Server responded at:', data.timestamp);
});
```

---

## ❌ Error Handling

### HTTP Status Codes
- `200` - Success
- `201` - Created (user registration)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `404` - Not Found
- `409` - Conflict (duplicate score submission)
- `500` - Internal Server Error

### Common Error Responses
```typescript
interface ApiError {
  error: string;
  statusCode?: number;
  details?: any;
}

// Examples:
{
  "error": "Email and password are required",
  "statusCode": 400
}

{
  "error": "You have already submitted a score. Each player can only submit once.",
  "alreadySubmitted": true,
  "statusCode": 409
}

{
  "error": "Score must be a non-negative number",
  "statusCode": 400
}
```

---

## 📝 TypeScript Types

### Core Types
```typescript
// User Management
interface User {
  userId: string;
  email: string;
  username: string;
}

interface CognitoTokenPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  exp: number;
  iat: number;
  aud: string;
  iss: string;
  token_use: 'access' | 'id';
}

// Score Management
interface ScoreRecord {
  userId: string;
  score: number;
  username: string;
  timestamp: string;
}

// API Responses
interface AuthResponse {
  success: boolean;
  message?: string;
  userSub?: string;
  error?: string;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
  };
  expiresIn?: number;
  user?: User;
}

// WebSocket Events
interface WebSocketNotification {
  type: 'HIGH_SCORE' | 'NEW_PLAYER' | 'GAME_EVENT' | 'LEADERBOARD_UPDATE';
  message: string;
  score?: number;
  username?: string;
  timestamp: string;
  data?: any;
}
```

---

## 🔨 Integration Examples

### Next.js App Setup

#### 1. Environment Variables (`.env.local`)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002
NEXT_PUBLIC_WS_URL=http://localhost:3002
```

#### 2. API Client (`lib/api.ts`)
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

class LeaderboardAPI {
  private getHeaders(token?: string) {
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  }

  async register(email: string, password: string, username: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password, username })
    });
    return response.json();
  }

  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, password })
    });
    return response.json();
  }

  async submitScore(score: number, token: string) {
    const response = await fetch(`${API_BASE_URL}/api/scores/submit`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ score })
    });
    return response.json();
  }

  async getLeaderboard(limit: number = 10) {
    const response = await fetch(`${API_BASE_URL}/api/leaderboard/top/${limit}`);
    return response.json();
  }

  async getUserProfile(token: string) {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: this.getHeaders(token)
    });
    return response.json();
  }
}

export const api = new LeaderboardAPI();
```

#### 3. WebSocket Hook (`hooks/useWebSocket.ts`)
```typescript
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  notifications: WebSocketNotification[];
  leaderboard: any[];
}

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<WebSocketNotification[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const socketConnection = io(process.env.NEXT_PUBLIC_WS_URL!);

    socketConnection.on('connect', () => {
      setIsConnected(true);
      // Request initial leaderboard data
      socketConnection.emit('request_leaderboard');
    });

    socketConnection.on('disconnect', () => {
      setIsConnected(false);
    });

    socketConnection.on('high_score', (data) => {
      setNotifications(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
    });

    socketConnection.on('leaderboard_update', (data) => {
      setLeaderboard(data.topScores);
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.close();
    };
  }, []);

  return { socket, isConnected, notifications, leaderboard };
}
```

#### 4. React Component Example
```typescript
'use client';
import { useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';

export function GameComponent() {
  const { isConnected, notifications, leaderboard } = useWebSocket();
  const [score, setScore] = useState<number>(0);
  const [token, setToken] = useState<string>(''); // Get from auth context

  const handleSubmitScore = async () => {
    try {
      const result = await api.submitScore(score, token);
      if (result.message) {
        alert(result.message);
      }
    } catch (error) {
      console.error('Score submission failed:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`} />
        WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
      </div>

      {/* Score Submission */}
      <div className="mb-6">
        <input
          type="number"
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          className="border p-2 mr-2"
          placeholder="Enter your score"
        />
        <button
          onClick={handleSubmitScore}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Submit Score
        </button>
      </div>

      {/* Real-time Leaderboard */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-3">🏆 Live Leaderboard</h2>
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <div key={index} className="flex justify-between p-3 bg-gray-100 rounded">
              <span>#{index + 1} {entry.username}</span>
              <span className="font-bold">{entry.score.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Notifications */}
      <div>
        <h3 className="text-lg font-semibold mb-2">📢 Live Notifications</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {notifications.map((notification, index) => (
            <div key={index} className={`p-2 rounded text-sm ${
              notification.type === 'HIGH_SCORE' ? 'bg-green-100' : 'bg-blue-100'
            }`}>
              <strong>{notification.type}:</strong> {notification.message}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 🚀 Quick Start Checklist

### Backend Setup
- [ ] Start WebSocket server: `npm run dev:ws`
- [ ] Verify API endpoints work
- [ ] Test WebSocket connections
- [ ] Configure AWS Cognito credentials

### Frontend Integration
- [ ] Install Socket.IO client: `npm install socket.io-client`
- [ ] Create API client with proper error handling
- [ ] Implement WebSocket hook for real-time features
- [ ] Add authentication context/state management
- [ ] Create UI components for leaderboard and notifications
- [ ] Test real-time score submissions and notifications

### Production Deployment
- [ ] Deploy backend with `npm run deploy`
- [ ] Update frontend environment variables
- [ ] Configure production WebSocket endpoint
- [ ] Test end-to-end functionality

---

## 📞 Support

For questions or issues:
1. Check the terminal output for detailed error messages
2. Verify WebSocket connection status via `/api/leaderboard/ws/stats`
3. Test individual API endpoints with tools like Postman
4. Review authentication token expiration and renewal

The API is designed to be robust with comprehensive error handling and real-time capabilities for an engaging user experience! 🎮
