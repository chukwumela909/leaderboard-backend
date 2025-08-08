import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { DynamoService } from '../services/dynamoService';
import { WebSocketService } from '../services/websocketService';
import { 
  ScoreSubmissionRequest, 
  ScoreSubmissionResponse, 
  CanSubmitResponse,
  User
} from '../types';

const router = Router();

// Submit score endpoint (protected route)
router.post('/submit', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { score }: ScoreSubmissionRequest = req.body;
    const user = req.user!;

    // Validate score
    if (typeof score !== 'number' || score < 0) {
      res.status(400).json({ 
        error: 'Score must be a non-negative number' 
      });
      return;
    }

    if (score > 1000000) {
      res.status(400).json({ 
        error: 'Score seems unrealistic. Maximum allowed is 1,000,000' 
      });
      return;
    }

    // Submit score to DynamoDB
    const result = await DynamoService.submitScore(user.userId, user.username, score);

    if (result.success) {
      // Send WebSocket notification if score > 1000
      if (score > 1000) {
        try {
          await WebSocketService.sendNotification({
            type: 'HIGH_SCORE',
            message: `${user.username} achieved a high score of ${score}!`,
            score,
            username: user.username,
            timestamp: new Date().toISOString()
          });
        } catch (wsError) {
          console.error('WebSocket notification failed:', wsError);
          // Don't fail the request if WebSocket fails
        }
      }

      res.json({
        message: 'Score submitted successfully!',
        isFirstScore: result.isFirstScore,
        score,
        notificationSent: score > 1000
      });
    } else {
      // Check if it's because user already submitted
      if (result.alreadySubmitted) {
        res.status(409).json({ 
          error: result.error,
          alreadySubmitted: true,
          message: 'You have already submitted your score. Each player can only submit once.'
        });
      } else {
        res.status(500).json({ error: result.error });
      }
    }
  } catch (error: any) {
    console.error('Submit score error:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

// Check if user can submit a score (hasn't submitted yet)
router.get('/can-submit', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const result = await DynamoService.getUserScore(user.userId);

    const response: CanSubmitResponse = {
      canSubmit: !result.success || !result.score,
      hasSubmitted: result.success && !!result.score,
      currentScore: result.success && result.score ? result.score.score : null
    };

    res.json(response);
  } catch (error: any) {
    console.error('Can submit check error:', error);
    res.status(500).json({ error: 'Failed to check submission status' });
  }
});

// Get user's personal best score (protected route)
router.get('/my-score', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    
    const result = await DynamoService.getUserScore(user.userId);

    if (result.success) {
      if (result.score) {
        res.json({
          score: {
            score: result.score.score,
            timestamp: result.score.timestamp,
            username: result.score.username
          }
        });
      } else {
        res.json({
          score: null,
          message: 'No score found for this user'
        });
      }
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Get user score error:', error);
    res.status(500).json({ error: 'Failed to get user score' });
  }
});

export { router as scoreRoutes };