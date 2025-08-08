import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { DynamoService } from '../services/dynamoService';
import { authenticateToken } from '../middleware/auth';
import { 
  SignUpParams, 
  SignInParams, 
  ConfirmSignUpParams, 
  UserProfileResponse,
  User
} from '../types';

const router = Router();

// Register new user
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username }: SignUpParams = req.body;

    // Basic validation
    if (!email || !password || !username) {
      res.status(400).json({ 
        error: 'Email, password, and username are required' 
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
      return;
    }

    const result = await AuthService.signUp({ email, password, username });

    if (result.success) {
      res.status(201).json({
        message: result.message,
        userSub: result.userSub
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Confirm email verification
router.post('/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, confirmationCode }: ConfirmSignUpParams = req.body;

    if (!email || !confirmationCode) {
      res.status(400).json({ 
        error: 'Email and confirmation code are required' 
      });
      return;
    }

    const result = await AuthService.confirmSignUp({ email, confirmationCode });

    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Confirm error:', error);
    res.status(500).json({ error: 'Email confirmation failed' });
  }
});

// Sign in user
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: SignInParams = req.body;

    if (!email || !password) {
      res.status(400).json({ 
        error: 'Email and password are required' 
      });
      return;
    }

    const result = await AuthService.signIn({ email, password });

    if (result.success) {
      res.json({
        message: 'Sign in successful',
        tokens: result.tokens,
        expiresIn: result.expiresIn
      });
    } else {
      res.status(401).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Sign in failed' });
  }
});

// Verify token (for testing)
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const result = await AuthService.verifyToken(authHeader);

    if (result.success) {
      res.json({
        message: 'Token valid',
        user: result.user
      });
    } else {
      res.status(401).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Verify error:', error);
    res.status(500).json({ error: 'Token verification failed' });
  }
});

// Get user profile and their score data
router.get('/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Get user's current score
    const scoreResult = await DynamoService.getUserScore(user.userId);
    
    // Get user's rank in leaderboard
    const topScoresResult = await DynamoService.getTopScores(100); // Get top 100 to determine rank
    let rank: number | null = null;
    let totalPlayers = 0;
    
    if (topScoresResult.success && topScoresResult.scores) {
      totalPlayers = topScoresResult.scores.length;
      const userRankIndex = topScoresResult.scores.findIndex(score => score.userId === user.userId);
      if (userRankIndex !== -1) {
        rank = userRankIndex + 1; // Convert to 1-based ranking
      }
    }

    const profile: UserProfileResponse = {
      user: {
        userId: user.userId,
        email: user.email,
        username: user.username
      },
      gameStats: {
        currentScore: scoreResult.success && scoreResult.score ? scoreResult.score.score : 0,
        lastPlayed: scoreResult.success && scoreResult.score ? scoreResult.score.timestamp : null,
        rank: rank,
        totalPlayers: totalPlayers
      }
    };

    res.json(profile);
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// Get user's score history (if you want to track multiple scores per user)
router.get('/my-scores', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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
          message: 'No scores found for this user'
        });
      }
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error: any) {
    console.error('Get user scores error:', error);
    res.status(500).json({ error: 'Failed to get user scores' });
  }
});

export { router as authRoutes };