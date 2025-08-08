import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { 
  ScoreRecord, 
  SubmitScoreResponse, 
  GetUserScoreResponse, 
  GetTopScoresResponse, 
  GetLeaderboardResponse,
  DynamoServiceResponse
} from '../types';

const dynamoClient = new DynamoDBClient({ 
  region: process.env.AWS_REGION || 'eu-west-1' 
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = 'leaderboard-scores';

export class DynamoService {
  static async submitScore(userId: string, username: string, score: number): Promise<SubmitScoreResponse> {
    try {
      const timestamp = new Date().toISOString();
      
      // Check if user already has a score
      const existingScore = await this.getUserScore(userId);
      
      if (existingScore.success && existingScore.score) {
        // User has already submitted a score - reject new submission
        return {
          success: false,
          error: 'You have already submitted a score. Each user can only submit once.',
          alreadySubmitted: true
        };
      }
      
      // First time submitting a score - allow submission
      const putCommand = new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          userId,
          score,
          username,
          timestamp,
        },
      });

      await docClient.send(putCommand);

      // After successful submission, trigger WebSocket notifications
      try {
        // Import WebSocketService here to avoid circular dependency
        const { WebSocketService } = await import('./websocketService');
        
        // Check if this is a high score (> 1000) and notify
        if (score > 1000) {
          await WebSocketService.notifyHighScore(username, score);
        }
        
        // Always notify about new player joining the leaderboard
        await WebSocketService.notifyNewPlayer(username);
        
        // Get updated leaderboard and broadcast it
        const topScoresResult = await this.getTopScores(10);
        if (topScoresResult.success && topScoresResult.scores) {
          await WebSocketService.broadcastLeaderboardUpdate(topScoresResult.scores);
        }
        
        console.log(`📊 Score submitted by ${username}: ${score} - WebSocket notifications sent`);
      } catch (wsError) {
        console.error('WebSocket notification error:', wsError);
        // Don't fail the score submission if WebSocket fails
      }

      return { 
        success: true, 
        isHighScore: true, // First score is always considered their "high score"
        isFirstScore: true,
        alreadySubmitted: false
      };
    } catch (error: any) {
      console.error('Submit score error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to submit score' 
      };
    }
  }

  static async getUserScore(userId: string): Promise<GetUserScoreResponse> {
    try {
      const queryCommand = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      });

      const result = await docClient.send(queryCommand);
      
      if (result.Items && result.Items.length > 0) {
        return { 
          success: true, 
          score: result.Items[0] as ScoreRecord 
        };
      } else {
        return { 
          success: true, 
          score: undefined 
        };
      }
    } catch (error: any) {
      console.error('Get user score error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get user score' 
      };
    }
  }

  static async getTopScores(limit: number = 10): Promise<GetTopScoresResponse> {
    try {
      // Use scan for now - in production you might want to use GSI
      // TODO: Consider using GSI with gameType as partition key and score as sort key
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
      });

      const result = await docClient.send(scanCommand);
      
      if (result.Items) {
        // Sort by score in descending order and take top N
        const sortedScores = (result.Items as ScoreRecord[])
          .filter(item => item.username && item.score !== undefined) // Ensure we have valid data
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        return { 
          success: true, 
          scores: sortedScores 
        };
      } else {
        return { 
          success: true, 
          scores: [] 
        };
      }
    } catch (error: any) {
      console.error('Get top scores error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get top scores' 
      };
    }
  }

  static async getLeaderboard(): Promise<GetLeaderboardResponse> {
    try {
      const topScoresResult = await this.getTopScores(1);
      
      if (topScoresResult.success && topScoresResult.scores && topScoresResult.scores.length > 0) {
        return {
          success: true,
          topScore: topScoresResult.scores[0]
        };
      } else {
        return {
          success: true,
          topScore: undefined
        };
      }
    } catch (error: any) {
      console.error('Get leaderboard error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to get leaderboard' 
      };
    }
  }

  // Utility method to fix existing records with user IDs as usernames
  static async fixUsernamesInExistingRecords(): Promise<DynamoServiceResponse<number>> {
    try {
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
      });

      const result = await docClient.send(scanCommand);
      let fixedCount = 0;

      if (result.Items) {
        for (const item of result.Items) {
          const record = item as ScoreRecord;
          
          // Check if username looks like a UUID (user ID)
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          
          if (uuidRegex.test(record.username)) {
            console.log(`Found record with user ID as username: ${record.username}`);
            
            // For now, we'll set a placeholder username
            // In a real scenario, you might want to fetch from Cognito
            const updateCommand = new PutCommand({
              TableName: TABLE_NAME,
              Item: {
                userId: record.userId,
                score: record.score,
                username: `User_${record.userId.substring(0, 8)}`, // Create a readable username
                timestamp: record.timestamp,
              },
            });
            
            await docClient.send(updateCommand);
            fixedCount++;
            console.log(`Fixed username for user ${record.userId}`);
          }
        }
      }

      return {
        success: true,
        data: fixedCount
      };
    } catch (error: any) {
      console.error('Fix usernames error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fix usernames'
      };
    }
  }

  // Method to clean up all records (use with caution!)
  static async clearAllScores(): Promise<DynamoServiceResponse<void>> {
    try {
      const scanCommand = new ScanCommand({
        TableName: TABLE_NAME,
      });

      const result = await docClient.send(scanCommand);

      if (result.Items) {
        // Delete all items
        for (const item of result.Items) {
          const deleteCommand = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: {
              userId: item.userId
            }
          });
          
          await docClient.send(deleteCommand);
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('Clear scores error:', error);
      return {
        success: false,
        error: error.message || 'Failed to clear scores'
      };
    }
  }
}