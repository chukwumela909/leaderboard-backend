import request from 'supertest';
import express from 'express';
import { authRoutes } from '../../src/routes/auth';
import { createTestToken, sampleUser } from '../utils';

// Mock AuthService
jest.mock('../../src/services/authService');
const mockAuthService = require('../../src/services/authService').AuthService;

describe('Auth Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /auth/signup', () => {
    it('should successfully register a new user', async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: true,
        userSub: 'test-user-sub',
        message: 'User registered successfully',
      });

      const signUpData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        username: 'testuser',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(signUpData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.userSub).toBe('test-user-sub');
      expect(mockAuthService.signUp).toHaveBeenCalledWith(signUpData);
    });

    it('should return 400 for invalid signup data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // Too short
        username: '',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle AuthService errors', async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      const signUpData = {
        email: 'existing@example.com',
        password: 'TestPassword123!',
        username: 'testuser',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(signUpData)
        .expect(400);

      expect(response.body.error).toBe('Email already exists');
    });
  });

  describe('POST /auth/signin', () => {
    it('should successfully sign in a user', async () => {
      mockAuthService.signIn.mockResolvedValue({
        success: true,
        accessToken: 'mock-access-token',
        idToken: 'mock-id-token',
        refreshToken: 'mock-refresh-token',
      });

      const signInData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      const response = await request(app)
        .post('/auth/signin')
        .send(signInData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBe('mock-access-token');
      expect(mockAuthService.signIn).toHaveBeenCalledWith(signInData);
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/auth/signin')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid credentials', async () => {
      mockAuthService.signIn.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const signInData = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      const response = await request(app)
        .post('/auth/signin')
        .send(signInData)
        .expect(401);

      expect(response.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/confirm', () => {
    it('should successfully confirm signup', async () => {
      mockAuthService.confirmSignUp.mockResolvedValue({
        success: true,
        message: 'Email confirmed successfully',
      });

      const confirmData = {
        email: 'test@example.com',
        confirmationCode: '123456',
      };

      const response = await request(app)
        .post('/auth/confirm')
        .send(confirmData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockAuthService.confirmSignUp).toHaveBeenCalledWith(confirmData);
    });

    it('should return 400 for missing confirmation data', async () => {
      const response = await request(app)
        .post('/auth/confirm')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle invalid confirmation codes', async () => {
      mockAuthService.confirmSignUp.mockResolvedValue({
        success: false,
        error: 'Invalid confirmation code',
      });

      const confirmData = {
        email: 'test@example.com',
        confirmationCode: 'invalid',
      };

      const response = await request(app)
        .post('/auth/confirm')
        .send(confirmData)
        .expect(400);

      expect(response.body.error).toBe('Invalid confirmation code');
    });
  });

  describe('POST /auth/verify', () => {
    it('should successfully verify a valid token', async () => {
      const token = createTestToken(sampleUser);
      
      mockAuthService.verifyToken.mockResolvedValue({
        success: true,
        user: sampleUser,
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({ token })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user).toEqual(sampleUser);
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(token);
    });

    it('should return 400 for missing token', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Token is required');
    });

    it('should handle invalid tokens', async () => {
      mockAuthService.verifyToken.mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('Input validation', () => {
    it('should validate email format in signup', async () => {
      const invalidEmailData = {
        email: 'not-an-email',
        password: 'ValidPassword123!',
        username: 'testuser',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.error).toContain('email');
    });

    it('should validate password strength in signup', async () => {
      const weakPasswordData = {
        email: 'test@example.com',
        password: '123',
        username: 'testuser',
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.error).toContain('password');
    });

    it('should validate username format in signup', async () => {
      const invalidUsernameData = {
        email: 'test@example.com',
        password: 'ValidPassword123!',
        username: '', // Empty username
      };

      const response = await request(app)
        .post('/auth/signup')
        .send(invalidUsernameData)
        .expect(400);

      expect(response.body.error).toContain('username');
    });
  });

  describe('Rate limiting', () => {
    it('should handle multiple requests within rate limits', async () => {
      mockAuthService.signIn.mockResolvedValue({
        success: true,
        accessToken: 'token',
        idToken: 'id-token',
      });

      const signInData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      // Make multiple requests
      const promises = Array(5).fill(0).map(() =>
        request(app)
          .post('/auth/signin')
          .send(signInData)
      );

      const responses = await Promise.all(promises);
      
      // All should succeed if within rate limits
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});
