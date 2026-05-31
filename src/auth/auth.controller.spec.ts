import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { UserRole } from './user-role';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

const VALID_SHA256 = sha256Hex('password123');
// Valid 64-char hex string (sha256 of 'admin123')
const ADMIN_SHA256 =
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            signup: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ── Login ─────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should return token for valid credentials', async () => {
      const mockResult = {
        token: 'jwt.token.here',
        expires_in: '3600',
        user_role: 'ADMIN',
      };
      authService.login.mockResolvedValue(mockResult);

      const result = await controller.login({
        username: 'admin',
        passwordSha256: ADMIN_SHA256,
      });

      expect(result).toEqual(mockResult);
      expect(authService.login).toHaveBeenCalledWith('admin', ADMIN_SHA256);
    });

    it('should return CANDIDATE role in token response', async () => {
      authService.login.mockResolvedValue({
        token: 'user.jwt.token',
        expires_in: '3600',
        user_role: 'CANDIDATE',
      });

      const result = await controller.login({
        username: 'alice',
        passwordSha256: VALID_SHA256,
      });

      expect(result.user_role).toBe('CANDIDATE');
    });

    it('should propagate UnauthorizedException from service', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('Invalid username or password.'),
      );

      await expect(
        controller.login({ username: 'wrong', passwordSha256: ADMIN_SHA256 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should pass passwordSha256 directly to service (not plaintext)', async () => {
      authService.login.mockResolvedValue({
        token: 't',
        expires_in: '3600',
        user_role: 'CANDIDATE',
      });

      await controller.login({
        username: 'test',
        passwordSha256: VALID_SHA256,
      });

      // Ensure the sha256 hash — not plaintext — is forwarded
      expect(authService.login).toHaveBeenCalledWith('test', VALID_SHA256);
      expect(authService.login).not.toHaveBeenCalledWith('test', 'password123');
    });
  });

  // ── Signup ────────────────────────────────────────────────────────────
  describe('signup', () => {
    const signupResult = {
      id: 'uuid-1',
      username: 'newuser',
      email: 'new@example.com',
      role: 'CANDIDATE',
      createdAt: new Date(),
    };

    it('should create user and return user info (without password)', async () => {
      authService.signup.mockResolvedValue(signupResult);

      const result = await controller.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: VALID_SHA256,
      });

      expect(result).toEqual(signupResult);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('passwordSha256');
    });

    it('should pass all fields to service including passwordSha256', async () => {
      authService.signup.mockResolvedValue(signupResult);

      await controller.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: VALID_SHA256,
        role: UserRole.CANDIDATE,
      });

      expect(authService.signup).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: VALID_SHA256,
        role: 'CANDIDATE',
      });
    });

    it('should signup without optional role field', async () => {
      authService.signup.mockResolvedValue(signupResult);

      await controller.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: VALID_SHA256,
      });

      expect(authService.signup).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: VALID_SHA256,
        role: undefined,
      });
    });

    it('should propagate ConflictException for duplicate user', async () => {
      authService.signup.mockRejectedValue(
        new ConflictException('Username or email already exists.'),
      );

      await expect(
        controller.signup({
          username: 'existing',
          email: 'existing@example.com',
          passwordSha256: VALID_SHA256,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
