const jwt = require('jsonwebtoken');
const gameSocket = require('./gameSocket');

jest.mock('jsonwebtoken');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));
jest.mock('../models/User', () => ({}));
jest.mock('../models/Game', () => ({}));
jest.mock('../utils/gameEngine', () => ({}));

describe('gameSocket', () => {
  let io;
  let useMiddleware;

  beforeEach(() => {
    // Reset process.env and mocks
    process.env.JWT_SECRET = 'test_secret';
    jest.clearAllMocks();

    io = {
      use: jest.fn((middleware) => {
        useMiddleware = middleware;
      }),
      on: jest.fn(),
      sockets: {
        sockets: new Map()
      },
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };
  });

  describe('Authentication Middleware', () => {
    let socket;
    let next;

    beforeEach(() => {
      socket = {
        handshake: {
          auth: {}
        }
      };
      next = jest.fn();

      // Initialize the socket
      gameSocket(io);
    });

    it('should call next with an error if no token is provided', () => {
      useMiddleware(socket, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Authentication error');
    });

    it('should call next with an error if jwt.verify throws', () => {
      socket.handshake.auth.token = 'invalid_token';
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      useMiddleware(socket, next);

      expect(jwt.verify).toHaveBeenCalledWith('invalid_token', 'test_secret');
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(next.mock.calls[0][0].message).toBe('Authentication error');
    });

    it('should attach user to socket and call next without error on success', () => {
      socket.handshake.auth.token = 'valid_token';
      const decodedUser = { id: '123', username: 'testuser' };
      jwt.verify.mockReturnValue(decodedUser);

      useMiddleware(socket, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');
      expect(socket.user).toEqual(decodedUser);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(); // Called with no arguments
    });
  });
});
