import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import serverless from 'serverless-http';
import { authRoutes } from './routes/auth';
import { scoreRoutes } from './routes/scores';
import { leaderboardRoutes } from './routes/leaderboard';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'leaderboard-api'
  });
});

// Socket.IO test endpoint
app.get('/socket.io/test', (req, res) => {
  res.json({
    status: 'Socket.IO is available',
    timestamp: new Date().toISOString(),
    path: '/socket.io/',
    transports: ['websocket', 'polling']
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export for serverless
export const handler = serverless(app);

// Export for local development
export default app;