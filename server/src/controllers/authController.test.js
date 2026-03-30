const { register } = require('./authController');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

jest.mock('../models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('authController - register', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  it('should return 400 if username is missing', async () => {
    delete req.body.username;
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'All fields required' });
  });

  it('should return 400 if email is missing', async () => {
    delete req.body.email;
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'All fields required' });
  });

  it('should return 400 if password is missing', async () => {
    delete req.body.password;
    await register(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'All fields required' });
  });

  it('should return 409 if user already exists via User.exists', async () => {
    User.exists.mockResolvedValueOnce(true);
    await register(req, res);

    expect(User.exists).toHaveBeenCalledWith({
      $or: [{ email: 'test@example.com' }, { username: 'testuser' }],
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Username or email already taken' });
  });

  it('should return 409 if MongoDB throws duplicate key error (code 11000)', async () => {
    User.exists.mockResolvedValueOnce(false);
    bcrypt.hash.mockResolvedValueOnce('hashedPassword');

    const error = new Error('Duplicate key');
    error.code = 11000;
    User.create.mockRejectedValueOnce(error);

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Username or email already taken' });
  });

  it('should return 500 for other server errors', async () => {
    User.exists.mockRejectedValueOnce(new Error('Database error'));

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Server error', error: 'Database error' });
  });

  it('should successfully register a new user', async () => {
    User.exists.mockResolvedValueOnce(false);
    bcrypt.hash.mockResolvedValueOnce('hashedPassword');

    const mockDoc = {
      _id: { toString: () => 'mockId123' },
      username: 'testuser',
      email: 'test@example.com',
      wins: 0,
      losses: 0,
    };

    User.create.mockResolvedValueOnce(mockDoc);
    jwt.sign.mockReturnValueOnce('mockJwtToken');

    const originalJwtSecret = process.env.JWT_SECRET;
    const originalJwtExpiresIn = process.env.JWT_EXPIRES_IN;
    process.env.JWT_SECRET = 'testSecret';
    process.env.JWT_EXPIRES_IN = '1h';

    await register(req, res);

    expect(User.create).toHaveBeenCalledWith({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedPassword',
    });
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: 'mockId123', username: 'testuser' },
      'testSecret',
      { expiresIn: '1h' }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      token: 'mockJwtToken',
      user: {
        id: 'mockId123',
        username: 'testuser',
        email: 'test@example.com',
        wins: 0,
        losses: 0,
      }
    });

    process.env.JWT_SECRET = originalJwtSecret;
    process.env.JWT_EXPIRES_IN = originalJwtExpiresIn;
  });
});
