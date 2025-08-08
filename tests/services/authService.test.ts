import { AuthService } from '../../src/services/authService';
import { createTestToken, createExpiredToken, sampleUser, TEST_JWT_SECRET } from '../utils';

// Mock AWS SDK
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({
    send: jest.fn(),
  })),
  SignUpCommand: jest.fn(),
  SignInCommand: jest.fn(),
  ConfirmSignUpCommand: jest.fn(),
  InitiateAuthCommand: jest.fn(),
  RespondToAuthChallengeCommand: jest.fn(),
  AdminGetUserCommand: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

const mockJwt = jest.mocked(require('jsonwebtoken'));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('signUp', () => {
    it('should successfully register a new user', async () => {
      const mockCognitoClient = {
        send: jest.fn().mockResolvedValue({
          UserSub: 'test-user-sub',
        }),
      };

      // Mock the CognitoIdentityProviderClient constructor
      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

      const signUpParams = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        username: 'testuser',
      };

      const result = await AuthService.signUp(signUpParams);

      expect(result.success).toBe(true);
      expect(result.userSub).toBe('test-user-sub');
      expect(result.message).toContain('User registered successfully');
    });

    it('should handle signup errors', async () => {
      const mockCognitoClient = {
        send: jest.fn().mockRejectedValue(new Error('Username already exists')),
      };

      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

      const signUpParams = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        username: 'testuser',
      };

      const result = await AuthService.signUp(signUpParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('signIn', () => {
    it('should successfully sign in a user', async () => {
      const mockCognitoClient = {
        send: jest.fn().mockResolvedValue({
          AuthenticationResult: {
            AccessToken: 'mock-access-token',
            IdToken: 'mock-id-token',
            RefreshToken: 'mock-refresh-token',
          },
        }),
      };

      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

      const signInParams = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const result = await AuthService.signIn(signInParams);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.idToken).toBe('mock-id-token');
    });

    it('should handle invalid credentials', async () => {
      const mockCognitoClient = {
        send: jest.fn().mockRejectedValue(new Error('Incorrect username or password')),
      };

      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

      const signInParams = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const result = await AuthService.signIn(signInParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and extract user data', async () => {
      const mockPayload = {
        sub: 'test-user-id',
        email: 'test@example.com',
        preferred_username: 'testuser',
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      const result = await AuthService.verifyToken('valid-token');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({
        userId: 'test-user-id',
        email: 'test@example.com',
        username: 'testuser',
      });
    });

    it('should handle token verification errors', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      const result = await AuthService.verifyToken('expired-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should fallback to email prefix when username is missing', async () => {
      const mockPayload = {
        sub: 'test-user-id',
        email: 'testuser@example.com',
        // No preferred_username
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      const mockCognitoClient = {
        send: jest.fn().mockRejectedValue(new Error('User not found')),
      };

      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

      const result = await AuthService.verifyToken('valid-token');

      expect(result.success).toBe(true);
      expect(result.user?.username).toBe('testuser'); // Email prefix
    });
  });

  describe('confirmSignUp', () => {
    it('should successfully confirm signup', async () => {
      const mockCognitoClient = {
        send: jest.fn().mockResolvedValue({}),
      };

      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

      const confirmParams = {
        email: 'test@example.com',
        confirmationCode: '123456',
      };

      const result = await AuthService.confirmSignUp(confirmParams);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Email confirmed successfully');
    });

    it('should handle invalid confirmation codes', async () => {
      const mockCognitoClient = {
        send: jest.fn().mockRejectedValue(new Error('Invalid verification code')),
      };

      const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
      CognitoIdentityProviderClient.mockImplementation(() => mockCognitoClient);

      const confirmParams = {
        email: 'test@example.com',
        confirmationCode: 'invalid',
      };

      const result = await AuthService.confirmSignUp(confirmParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
