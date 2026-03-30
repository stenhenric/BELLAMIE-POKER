const jwt = require('jsonwebtoken');
const authMiddleware = require('./auth');

jest.mock('jsonwebtoken');

describe('authMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();

    // Default environment variable
    process.env.JWT_SECRET = 'test-secret';

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  it('should return 401 if no authorization header is provided', () => {
    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 if authorization header does not start with Bearer', () => {
    req.headers.authorization = 'Basic somedata';

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set req.user and call next if token is valid', () => {
    req.headers.authorization = 'Bearer validtoken';
    const decodedPayload = { id: 1, username: 'testuser' };
    jwt.verify.mockReturnValue(decodedPayload);

    authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('validtoken', 'test-secret');
    expect(req.user).toEqual(decodedPayload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 if token is invalid or expired', () => {
    req.headers.authorization = 'Bearer invalidtoken';
    jwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    authMiddleware(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith('invalidtoken', 'test-secret');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });
});
