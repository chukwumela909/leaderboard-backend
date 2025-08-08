import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { User, CognitoTokenPayload } from '../types';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  clientId: process.env.COGNITO_CLIENT_ID!,
  tokenUse: 'id', // Using access token for API authentication
});

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    // Extract token from "Bearer <token>" format
    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'Token not found in authorization header' });
      return;
    }

    // Verify the token using aws-jwt-verify
    const payload = await verifier.verify(token);
    
    // Extract user information from the verified payload with proper type casting
    console.log('Verified JWT payload:', payload);
    req.user = {
      userId: payload.sub,
      email: (payload.email as string) || '',
      username: (payload['preferred_username'] as string) || 
                (payload['username'] as string) || 
                (payload.email as string) || 
                'Unknown User'
    };

    next();
  } catch (error: any) {
    console.error('Authentication middleware error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};