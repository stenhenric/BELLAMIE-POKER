const { register } = require('./authController');

describe('authController', () => {
  describe('register', () => {
    it('should return 400 if password is less than 8 characters', async () => {
      const req = {
        body: {
          username: 'testuser',
          email: 'test@example.com',
          password: 'short'
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Password must be at least 8 characters long' });
    });

    it('should return 400 if required fields are missing', async () => {
      const req = {
        body: {
          username: 'testuser',
          email: 'test@example.com'
          // password missing
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'All fields required' });
    });
  });
});
