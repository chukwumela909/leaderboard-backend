import { Router, Request, Response } from 'express';
import { DynamoService } from '../services/dynamoService';
import { 
  LeaderboardResponse,
  TopScoresResponse,
  DebugUsernamesResponse,
  FixUsernamesResponse,
  ClearScoresResponse
} from '../types';

const router = Router();

// Get current top 1 score (public route)
router.get('/top', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await DynamoService.getLeaderboard();

    if (result.success) {
      const response: LeaderboardResponse = {
        topScore: result.topScore ? {
          username: result.topScore.username,
          score: result.topScore.score,
          timestamp: result.topScore.timestamp
        } : null,
        message: result.topScore ? undefined : 'No scores submitted yet'
      };

      res.json(response);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get top N scores (public route) - bonus endpoint
router.get('/top/:limit', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.params.limit);
    
    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ 
        error: 'Limit must be a number between 1 and 100' 
      });
      return;
    }

    const result = await DynamoService.getTopScores(limit);

    if (result.success) {
      const response: TopScoresResponse = {
        topScores: result.scores?.map(score => ({
          username: score.username,
          score: score.score,
          timestamp: score.timestamp
        })) || [],
        count: result.scores?.length || 0
      };

      res.json(response);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Get top scores error:', error);
    res.status(500).json({ error: 'Failed to get top scores' });
  }
});

// Debug endpoint to check usernames in database
router.get('/debug/usernames', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await DynamoService.getTopScores(100); // Get more records to check

    if (result.success) {
      const records = result.scores?.map(score => ({
        userId: score.userId,
        username: score.username,
        score: score.score,
        isUserIdAsUsername: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(score.username)
      })) || [];

      const response: DebugUsernamesResponse = {
        records,
        totalRecords: records.length,
        recordsWithUserIdAsUsername: records.filter(r => r.isUserIdAsUsername).length
      };

      res.json(response);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Debug usernames error:', error);
    res.status(500).json({ error: 'Failed to debug usernames' });
  }
});

// Admin endpoint to fix usernames in existing records
router.post('/admin/fix-usernames', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await DynamoService.fixUsernamesInExistingRecords();

    if (result.success) {
      const response: FixUsernamesResponse = {
        message: `Fixed ${result.data} records with user IDs as usernames`,
        fixed: result.data || 0
      };

      res.json(response);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Fix usernames error:', error);
    res.status(500).json({ error: 'Failed to fix usernames' });
  }
});

// Admin endpoint to clear all scores (use with caution!)
router.delete('/admin/clear-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await DynamoService.clearAllScores();

    if (result.success) {
      const response: ClearScoresResponse = {
        message: 'All scores cleared successfully'
      };

      res.json(response);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Clear scores error:', error);
    res.status(500).json({ error: 'Failed to clear scores' });
  }
});

// HTTP-only: Get top scores with default limit via query (?limit=10)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limitParam = req.query.limit as string | undefined;
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 10;

    const result = await DynamoService.getTopScores(limit);

    if (result.success) {
      const response: TopScoresResponse = {
        topScores: result.scores?.map(score => ({
          username: score.username,
          score: score.score,
          timestamp: score.timestamp
        })) || [],
        count: result.scores?.length || 0
      };

      res.json(response);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Get leaderboard list error:', error);
    res.status(500).json({ error: 'Failed to get leaderboard list' });
  }
});

export { router as leaderboardRoutes };