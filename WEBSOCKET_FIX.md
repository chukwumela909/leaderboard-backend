# 🔧 WebSocket Frontend Fix

The WebSocket backend is working perfectly! The issue is in your Next.js frontend configuration. Here are the fixes:

## 1. **Fixed useWebSocket Hook**

Create this corrected version in your `hooks/useWebSocket.ts`:

```typescript
"use client";

import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

export interface WebSocketNotification {
  type: 'HIGH_SCORE' | 'NEW_PLAYER' | 'LEADERBOARD_UPDATE' | 'TEST';
  message: string;
  score?: number;
  username?: string;
  timestamp: string;
  data?: any;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  timestamp: string;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  notifications: WebSocketNotification[];
  leaderboard: LeaderboardEntry[];
  connectedClients: number;
  connectionError: string | null;
  sendTestNotification: (message: string) => void;
  requestLeaderboard: () => void;
  clearNotifications: () => void;
  reconnect: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<WebSocketNotification[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [connectedClients, setConnectedClients] = useState(0);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let socketConnection: Socket | null = null;

    const connectWebSocket = () => {
      try {
        console.log(`🔄 Attempting to connect to WebSocket: ${WS_URL}`);
        setConnectionError(null);

        // ✅ Fixed configuration - match backend settings
        socketConnection = io(WS_URL, {
          transports: ['websocket', 'polling'], // Allow both transports
          timeout: 10000,
          reconnection: true, // Enable automatic reconnection
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          forceNew: false, // Allow reusing connections
          autoConnect: true,
          // ✅ Add additional options for better compatibility
          upgrade: true,
          rememberUpgrade: false,
        });

        // Connection events
        socketConnection.on('connect', () => {
          console.log('🔗 Connected to leaderboard WebSocket');
          console.log('📡 Socket ID:', socketConnection?.id);
          console.log('🚀 Transport:', socketConnection?.io.engine.transport.name);
          
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;
          
          // Request initial leaderboard data
          socketConnection?.emit('request_leaderboard');
        });

        socketConnection.on('disconnect', (reason) => {
          console.log('🔌 Disconnected from WebSocket:', reason);
          setIsConnected(false);
          
          // Only manual reconnect if it's not a client-side disconnect
          if (reason !== 'io client disconnect') {
            console.log('🔄 Will attempt to reconnect...');
          }
        });

        socketConnection.on('connect_error', (error) => {
          console.error('❌ WebSocket connection error:', error);
          setIsConnected(false);
          
          const errorMessage = error.message || 'Unknown connection error';
          setConnectionError(`Connection failed: ${errorMessage}`);
          
          reconnectAttempts.current++;
          if (reconnectAttempts.current >= maxReconnectAttempts) {
            setConnectionError(`Connection failed after ${maxReconnectAttempts} attempts. Server may be offline.`);
          }
        });

        // ✅ Handle transport upgrade
        socketConnection.io.on('upgrade', () => {
          console.log('🚀 Upgraded transport to:', socketConnection?.io.engine.transport.name);
        });

        // Set up event handlers
        setupEventHandlers(socketConnection);
        
        setSocket(socketConnection);
      } catch (error) {
        console.error('❌ Failed to create WebSocket connection:', error);
        setConnectionError('Failed to initialize WebSocket');
      }
    };

    // Set up event handlers in a separate function
    const setupEventHandlers = (socket: Socket) => {
      // Welcome message
      socket.on('welcome', (data) => {
        console.log('👋 Welcome message:', data);
        // Update connected clients count if provided
        if (data.connectedClients !== undefined) {
          setConnectedClients(data.connectedClients);
        }
      });

      // High score notifications
      socket.on('high_score', (data: WebSocketNotification) => {
        console.log('🎉 High score achieved:', data);
        setNotifications(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
      });

      // New player notifications
      socket.on('new_player', (data: WebSocketNotification) => {
        console.log('👋 New player joined:', data);
        setNotifications(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
      });

      // Real-time leaderboard updates
      socket.on('leaderboard_update', (data: { topScores: LeaderboardEntry[]; timestamp: string; type?: string }) => {
        console.log('📊 Leaderboard updated:', data);
        setLeaderboard(data.topScores || []);
        
        // Add as notification if it's an update event
        if (data.type === 'LEADERBOARD_UPDATE') {
          const notification: WebSocketNotification = {
            type: 'LEADERBOARD_UPDATE',
            message: `📊 Leaderboard updated with ${data.topScores?.length || 0} scores`,
            timestamp: data.timestamp
          };
          setNotifications(prev => [notification, ...prev.slice(0, 9)]);
        }
      });

      // General notifications
      socket.on('notification', (data: WebSocketNotification) => {
        console.log('🔔 Notification:', data);
        setNotifications(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
      });

      // Pong response
      socket.on('pong', (data) => {
        console.log('🏓 Server responded at:', data.timestamp);
      });

      // Error handling
      socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
        setConnectionError(`Socket error: ${error.message || error}`);
      });
    };

    // Initial connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      
      if (socketConnection) {
        socketConnection.removeAllListeners();
        socketConnection.close();
      }
      
      setSocket(null);
      setIsConnected(false);
    };
  }, []);

  // Helper functions
  const sendTestNotification = (message: string) => {
    if (socket && isConnected) {
      // Send via API instead of socket event since it's handled by REST endpoint
      fetch(`${WS_URL}/api/leaderboard/ws/test-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type: 'TEST' })
      }).catch(console.error);
    }
  };

  const requestLeaderboard = () => {
    if (socket && isConnected) {
      socket.emit('request_leaderboard');
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const reconnect = () => {
    console.log('🔄 Manual reconnect requested');
    reconnectAttempts.current = 0;
    setConnectionError(null);
    
    if (socket) {
      socket.removeAllListeners();
      socket.close();
    }
    
    // Force a new connection by clearing socket state
    setSocket(null);
    setIsConnected(false);
  };

  // Ping server periodically to maintain connection
  useEffect(() => {
    if (socket && isConnected) {
      const pingInterval = setInterval(() => {
        socket.emit('ping');
      }, 30000); // Ping every 30 seconds

      return () => clearInterval(pingInterval);
    }
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    notifications,
    leaderboard,
    connectedClients,
    connectionError,
    sendTestNotification,
    requestLeaderboard,
    clearNotifications,
    reconnect,
  };
}
```

## 2. **Environment Variables**

Make sure your Next.js `.env.local` file has:

```env
NEXT_PUBLIC_WS_URL=http://localhost:3002
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002
```

## 3. **Package Dependencies**

Make sure you have the correct Socket.IO client version in your Next.js app:

```bash
npm install socket.io-client@^4.7.2
```

## 4. **Browser DevTools Testing**

Open your browser DevTools (F12) and in the Console tab, test the WebSocket connection manually:

```javascript
// Test in browser console
const socket = io('http://localhost:3002', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  socket.emit('request_leaderboard');
});

socket.on('welcome', (data) => console.log('👋 Welcome:', data));
socket.on('leaderboard_update', (data) => console.log('📊 Leaderboard:', data));
```

## 5. **Common Issues & Solutions**

### Issue: "WebSocket connection failed"
**Solution**: Make sure:
- Backend server is running on port 3002
- CORS is properly configured
- No firewall blocking the connection

### Issue: "Transport error"
**Solution**: 
- Enable both websocket and polling transports
- Check if port 3002 is accessible
- Try polling transport first, then upgrade to websocket

### Issue: "Connection timeout"
**Solution**:
- Increase timeout values
- Check network connectivity
- Verify backend server logs

## 6. **Testing Steps**

1. **Start Backend**: `npm run dev:ws` (should show "WebSocket service initialized")
2. **Test Node.js Client**: `node test-websocket.js` (should connect successfully)
3. **Start Next.js App**: Your frontend should now connect properly
4. **Check Browser DevTools**: Look for WebSocket connection logs

The backend is working perfectly - these frontend fixes should resolve your WebSocket connection issues! 🚀
