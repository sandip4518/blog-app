const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const Post = require('../models/Post');
const bcrypt = require('bcryptjs');

// Mock DOM libraries
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

jest.mock('../models/User');
jest.mock('../models/Post');
jest.mock('../database', () => jest.fn());

describe('Post Endpoints', () => {
  let authCookie;
  const mockUser = {
    _id: 'user123',
    username: 'testuser',
    password: 'hashedpassword'
  };

  beforeAll(async () => {
    // Setup for Login
    User.findOne.mockResolvedValue(mockUser);
    bcrypt.compareSync = jest.fn().mockReturnValue(true);
    User.findById.mockResolvedValue(mockUser);

    // Perform Login
    const res = await request(app)
      .post('/login')
      .send({ username: 'testuser', password: 'password' });

    authCookie = res.headers['set-cookie'];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply mocks that might be cleared
    User.findById.mockResolvedValue(mockUser); 
  });

  describe('GET /my-posts', () => {
    it('should return user posts', async () => {
      const mockPosts = [
        { title: 'Post 1', content: 'Content 1', userId: 'user123' },
        { title: 'Post 2', content: 'Content 2', userId: 'user123' }
      ];
      
      // Chain mock for sort and lean
      const mockFind = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPosts)
      };
      Post.find.mockReturnValue(mockFind);

      const res = await request(app)
        .get('/my-posts')
        .set('Cookie', authCookie);

      expect(res.statusCode).toEqual(200);
      expect(res.text).toContain('Post 1');
      expect(res.text).toContain('Post 2');
    });
  });

  describe('POST /posts', () => {
    it('should create a new post', async () => {
      Post.create.mockResolvedValue({});

      const res = await request(app)
        .post('/posts')
        .set('Cookie', authCookie)
        .send({ title: 'New Post', content: 'New Content' });

      expect(res.statusCode).toEqual(302); // Redirects to /my-posts
      expect(Post.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Post',
        content: 'New Content',
        userId: 'user123'
      }));
    });
  });
});
