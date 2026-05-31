import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: { validateUserById: jest.Mock };

  const mockUser = {
    id: 'user-uuid-1',
    username: 'testuser',
    email: 'test@example.com',
    role: 'CANDIDATE',
  };

  beforeEach(() => {
    authService = {
      validateUserById: jest.fn(),
    };
    // Set env for JWT secret
    process.env.JWT_SECRET = 'test-secret';
    strategy = new JwtStrategy(authService as unknown as AuthService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user object for valid payload', async () => {
      authService.validateUserById.mockResolvedValue(mockUser);

      const result = await strategy.validate({
        sub: 'user-uuid-1',
        username: 'testuser',
        role: 'CANDIDATE',
      });

      expect(result).toEqual(mockUser);
    });

    it('should call authService.validateUserById with payload.sub', async () => {
      authService.validateUserById.mockResolvedValue(mockUser);

      await strategy.validate({
        sub: 'user-uuid-1',
        username: 'testuser',
        role: 'CANDIDATE',
      });

      expect(authService.validateUserById).toHaveBeenCalledWith('user-uuid-1');
    });

    it('should throw UnauthorizedException when user not found (null)', async () => {
      authService.validateUserById.mockResolvedValue(null);

      await expect(
        strategy.validate({
          sub: 'invalid-uuid',
          username: 'ghost',
          role: 'CANDIDATE',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found (undefined)', async () => {
      authService.validateUserById.mockResolvedValue(undefined);

      await expect(
        strategy.validate({
          sub: 'invalid-uuid',
          username: 'ghost',
          role: 'CANDIDATE',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return ADMIN user correctly', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      authService.validateUserById.mockResolvedValue(adminUser);

      const result = await strategy.validate({
        sub: 'admin-uuid',
        username: 'admin',
        role: 'ADMIN',
      });

      expect(result.role).toBe('ADMIN');
    });

    it('should not return passwordHash in user object', async () => {
      authService.validateUserById.mockResolvedValue(mockUser);

      const result = await strategy.validate({
        sub: 'user-uuid-1',
        username: 'testuser',
        role: 'CANDIDATE',
      });

      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
