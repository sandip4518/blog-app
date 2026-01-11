const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Mock DOM libraries to verify ESM issues
jest.mock('isomorphic-dompurify', () => {
  return jest.fn(() => ({
    sanitize: (str) => str
  }));
});

jest.mock('jsdom', () => ({
  JSDOM: class {
    constructor() {
      this.window = {};
    }
  }
}));

// Mock Mongoose models and database connection
jest.mock('../models/User');
jest.mock('../database', () => jest.fn());

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should register a new user successfully', async () => {
      User.create.mockResolvedValue({
        _id: '123',
        username: 'testuser',
        password: 'hashedpassword'
      });
      User.findOne.mockResolvedValue(null); // No existing user

      const res = await request(app)
        .post('/register')
        .send({
          username: 'testuser',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(302);
      expect(res.headers.location).toBe('/login');
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        username: 'testuser'
      }));
    });

    it('should validate input', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          username: 'ab', // Too short
          password: 'pass' // Too short
        });

      expect(res.statusCode).toEqual(200); // Renders register page with error
      expect(res.text).toContain('Username must be at least 3 characters long');
    });
  });

  // Note: Testing Login with Passport involves mocking strategy or session which is complex.
  // We will trust Passport works if configured correctly, or use integration tests with a real DB.
  // For now, we tested the critical registration logic.
});
