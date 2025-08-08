import { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand, RespondToAuthChallengeCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import jwt from 'jsonwebtoken';
import { 
  SignUpParams, 
  SignInParams, 
  ConfirmSignUpParams, 
  AuthResponse, 
  TokenVerificationResponse,
  User,
  CognitoTokenPayload
} from '../types';


const cognitoClient = new CognitoIdentityProviderClient({ 
  region: process.env.AWS_REGION || 'eu-west-1' 
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const REGION = process.env.AWS_REGION || 'eu-west-1';

export class AuthService {
  static async signUp({ email, password, username }: SignUpParams): Promise<AuthResponse> {
    try {
      const command = new SignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          {
            Name: 'email',
            Value: email,
          },
          {
            Name: 'preferred_username',
            Value: username,
          }
        ],
      });

      const result = await cognitoClient.send(command);
      
      return {
        success: true,
        userSub: result.UserSub,
        message: 'User registered successfully. Please check your email for verification code.'
      };
    } catch (error: any) {
      console.error('SignUp error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }

  static async confirmSignUp({ email, confirmationCode }: ConfirmSignUpParams): Promise<AuthResponse> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: CLIENT_ID,
        Username: email,
        ConfirmationCode: confirmationCode,
      });

      await cognitoClient.send(command);
      
      return {
        success: true,
        message: 'Email verified successfully. You can now sign in.'
      };
    } catch (error: any) {
      console.error('ConfirmSignUp error:', error);
      return {
        success: false,
        error: error.message || 'Email verification failed'
      };
    }
  }

  static async signIn({ email, password }: SignInParams): Promise<AuthResponse> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const result = await cognitoClient.send(command);

      if (result.AuthenticationResult) {
        return {
          success: true,
          tokens: {
            accessToken: result.AuthenticationResult.AccessToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            idToken: result.AuthenticationResult.IdToken,
          },
          expiresIn: result.AuthenticationResult.ExpiresIn
        };
      } else {
        return {
          success: false,
          error: 'Authentication failed'
        };
      }
    } catch (error: any) {
      console.error('SignIn error:', error);
      return {
        success: false,
        error: error.message || 'Sign in failed'
      };
    }
  }

  static async verifyToken(token: string): Promise<TokenVerificationResponse> {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, '');
      
      // For development, you might want to skip verification
      // In production, you should verify against Cognito's public keys
      const decoded = jwt.decode(cleanToken, { complete: true });
      
      if (!decoded) {
        throw new Error('Invalid token');
      }

      // Basic validation
      const payload = decoded.payload as any;
      const now = Math.floor(Date.now() / 1000);
      
      if (payload.exp && payload.exp < now) {
        throw new Error('Token expired');
      }

      // Try to get username from token first
      let username = payload.preferred_username || payload['cognito:username'] || payload.username;
      
      console.log('Token payload keys:', Object.keys(payload));
      console.log('Username from token:', username);
      console.log('User sub:', payload.sub);
      console.log('User email:', payload.email);
      
      // If username is not in token, fetch from Cognito
      if (!username && payload.email) {
        try {
          console.log('Fetching username from Cognito for email:', payload.email);
          const getUserCommand = new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: payload.email  // Use email as username, not sub
          });
          
          const userResult = await cognitoClient.send(getUserCommand);
          console.log('Cognito user attributes:', userResult.UserAttributes?.map(attr => ({ Name: attr.Name, Value: attr.Value })));
          const preferredUsernameAttr = userResult.UserAttributes?.find(attr => attr.Name === 'preferred_username');
          username = preferredUsernameAttr?.Value;
          console.log('Username from Cognito preferred_username:', username);
          
          // If still no preferred_username, try other username fields
          if (!username) {
            const usernameAttr = userResult.UserAttributes?.find(attr => attr.Name === 'username');
            username = usernameAttr?.Value;
            console.log('Username from Cognito username attr:', username);
          }
        } catch (cognitoError) {
          console.warn('Could not fetch username from Cognito:', cognitoError);
          username = payload.email?.split('@')[0] || 'Unknown User'; // Use email prefix as fallback
        }
      }
      
      // Final fallback - if still no username, use email prefix or Unknown User
      if (!username) {
        username = payload.email?.split('@')[0] || 'Unknown User';
      }

      return {
        success: true,
        user: {
          userId: payload.sub,
          email: payload.email,
          username: username,
        }
      };
    } catch (error: any) {
      console.error('Token verification error:', error);
      return {
        success: false,
        error: error.message || 'Token verification failed'
      };
    }
  }
}