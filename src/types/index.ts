// User related types
export interface User {
  userId: string;
  email: string;
  username: string;
}

export interface CognitoTokenPayload {
  sub: string;
  email?: string;
  preferred_username?: string;
  username?: string;
  'cognito:username'?: string;
  exp: number;
  iat: number;
  aud: string;
  iss: string;
  token_use: 'access' | 'id';
  email_verified?: boolean;
  auth_time?: number;
  event_id?: string;
  jti?: string;
  origin_jti?: string;
}

// Score related types
export interface ScoreRecord {
  userId: string;
  score: number;
  username: string;
  timestamp: string;
}

export interface ScoreSubmissionRequest {
  score: number;
}

export interface ScoreSubmissionResponse {
  success: boolean;
  message: string;
  isFirstScore?: boolean;
  score?: number;
  notificationSent?: boolean;
  error?: string;
  alreadySubmitted?: boolean;
}

export interface CanSubmitResponse {
  canSubmit: boolean;
  hasSubmitted: boolean;
  currentScore: number | null;
}

// Auth related types
export interface SignUpParams {
  email: string;
  password: string;
  username: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface ConfirmSignUpParams {
  email: string;
  confirmationCode: string;
}

export interface AuthResponse {
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

export interface TokenVerificationResponse {
  success: boolean;
  user?: User;
  error?: string;
}

// DynamoDB service types
export interface DynamoServiceResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface SubmitScoreResponse extends DynamoServiceResponse {
  isHighScore?: boolean;
  isFirstScore?: boolean;
  alreadySubmitted?: boolean;
}

export interface GetUserScoreResponse extends DynamoServiceResponse<ScoreRecord> {
  score?: ScoreRecord;
}

export interface GetTopScoresResponse extends DynamoServiceResponse<ScoreRecord[]> {
  scores?: ScoreRecord[];
}

export interface GetLeaderboardResponse extends DynamoServiceResponse<ScoreRecord> {
  topScore?: ScoreRecord;
}

// Leaderboard types
export interface LeaderboardEntry {
  username: string;
  score: number;
  timestamp: string;
}

export interface TopScoresResponse {
  topScores: LeaderboardEntry[];
  count: number;
}

export interface UserProfileResponse {
  user: User;
  gameStats: {
    currentScore: number;
    lastPlayed: string | null;
    rank: number | null;
    totalPlayers: number;
  };
}

// WebSocket notification types
export interface WebSocketNotification {
  type: 'HIGH_SCORE' | 'NEW_PLAYER' | 'GAME_EVENT';
  message: string;
  score?: number;
  username?: string;
  timestamp: string;
  data?: any;
}

// Error types
export interface ApiError {
  error: string;
  statusCode?: number;
  details?: any;
}

// Request types with user attached
export interface AuthenticatedRequest extends Request {
  user: User;
}

// Additional leaderboard response types
export interface LeaderboardResponse {
  topScore: {
    username: string;
    score: number;
    timestamp: string;
  } | null;
  message?: string;
}

export interface DebugUsernamesResponse {
  records: {
    userId: string;
    username: string;
    score: number;
    isUserIdAsUsername: boolean;
  }[];
  totalRecords: number;
  recordsWithUserIdAsUsername: number;
}

export interface FixUsernamesResponse {
  message: string;
  fixed: number;
}

export interface ClearScoresResponse {
  message: string;
}

// Enhanced DynamoDB service response for admin operations
export interface FixUsernamesServiceResponse extends DynamoServiceResponse {
  fixed?: number;
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
