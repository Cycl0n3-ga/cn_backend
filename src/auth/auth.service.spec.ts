import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-uuid-1',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '',
    role: 'CANDIDATE',
    solvedCount: 0,
    rating: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // The password stored in DB is bcrypt(sha256('password123'))
    mockUser.passwordHash = await bcrypt.hash(sha256Hex('password123'), 10);

    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── login ─────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should return token for valid SHA-256 credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login('testuser', sha256Hex('password123'));

      expect(result).toHaveProperty('token', 'mock-jwt-token');
      expect(result).toHaveProperty('expires_in');
      expect(result).toHaveProperty('user_role', 'CANDIDATE');
    });

    it('should include correct JWT payload (sub, username, role)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await service.login('testuser', sha256Hex('password123'));

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        role: mockUser.role,
      });
    });

    it('should return expires_in as string (not number)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login('testuser', sha256Hex('password123'));

      expect(typeof result.expires_in).toBe('string');
    });

    it('should look up user by username', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await service.login('testuser', sha256Hex('password123'));

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent', sha256Hex('password123')),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong SHA-256 password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login('testuser', sha256Hex('wrongpassword')),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if plain password (not sha256) is used', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      // Plain text password should fail because stored hash is bcrypt(sha256(password))
      await expect(service.login('testuser', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException with generic message (no info leak)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('nonexistent', sha256Hex('any')),
      ).rejects.toThrow('Invalid username or password.');
    });

    it('should handle ADMIN role correctly', async () => {
      const adminUser = { ...mockUser, role: 'ADMIN' };
      prisma.user.findUnique.mockResolvedValue(adminUser);

      const result = await service.login('testuser', sha256Hex('password123'));

      expect(result.user_role).toBe('ADMIN');
    });
  });

  // ── signup ────────────────────────────────────────────────────────────
  describe('signup', () => {
    const newUserResult = {
      id: 'new-uuid',
      username: 'newuser',
      email: 'new@example.com',
      role: 'CANDIDATE',
      createdAt: new Date(),
    };

    it('should create a new user with sha256 password', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUserResult);

      const result = await service.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: sha256Hex('password123'),
      });

      expect(result).toHaveProperty('username', 'newuser');
      expect(result).toHaveProperty('email', 'new@example.com');
    });

    it('should call prisma.user.create with a bcrypt hash (not plain sha256)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUserResult);

      const sha256 = sha256Hex('password123');
      await service.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: sha256,
      });

      // The call should contain a bcrypt hash, not the sha256 value directly
      const createCall = prisma.user.create.mock.calls[0][0];
      const storedHash = createCall.data.passwordHash;
      expect(storedHash).not.toBe(sha256);
      expect(storedHash).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
    });

    it('should return user without passwordHash field', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUserResult);

      const result = await service.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: sha256Hex('password123'),
      });

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should default role to CANDIDATE if not specified', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUserResult);

      await service.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: sha256Hex('password123'),
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('CANDIDATE');
    });

    it('should create candidate account without email', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...newUserResult,
        email: null,
        role: 'CANDIDATE',
      });

      const result = await service.signup({
        username: 'candidate1',
        passwordSha256: sha256Hex('candidate123'),
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        username: 'candidate1',
        email: null,
        role: 'CANDIDATE',
      });
      expect(result).toHaveProperty('email', null);
    });

    it('should always force role to CANDIDATE regardless of input', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ ...newUserResult, role: 'CANDIDATE' });

      await service.signup({
        username: 'adminuser',
        email: 'admin@example.com',
        passwordSha256: sha256Hex('admin123'),
        role: 'ADMIN', // attacker tries to escalate
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('CANDIDATE');
    });

    it('should ignore role=QUESTIONER and force CANDIDATE', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...newUserResult,
        role: 'CANDIDATE',
      });

      await service.signup({
        username: 'questioner1',
        email: 'questioner1@example.com',
        passwordSha256: sha256Hex('questioner123'),
        role: 'questioner',
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('CANDIDATE');
    });

    it('should allow signup without email for CANDIDATE (even with role=EXAMINER)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...newUserResult,
        email: null,
        role: 'CANDIDATE',
      });

      // role is ignored; email is optional for CANDIDATE
      const result = await service.signup({
        username: 'examiner1',
        passwordSha256: sha256Hex('examiner123'),
        role: 'EXAMINER',
      });

      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.role).toBe('CANDIDATE');
    });

    it('should throw ConflictException for duplicate username', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.signup({
          username: 'testuser',
          email: 'another@example.com',
          passwordSha256: sha256Hex('password123'),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate email', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.signup({
          username: 'anotheruser',
          email: 'test@example.com',
          passwordSha256: sha256Hex('password123'),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should check both username and email for conflicts via OR query', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUserResult);

      await service.signup({
        username: 'newuser',
        email: 'new@example.com',
        passwordSha256: sha256Hex('password123'),
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ username: 'newuser' }, { email: 'new@example.com' }],
        },
      });
    });
  });

  // ── validateUserById ──────────────────────────────────────────────────
  describe('validateUserById', () => {
    it('should return user info for valid ID', async () => {
      const mockSelected = {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: mockUser.role,
      };
      prisma.user.findUnique.mockResolvedValue(mockSelected);

      const result = await service.validateUserById(mockUser.id);

      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('id', mockUser.id);
    });

    it('should not return passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: mockUser.role,
      });

      const result = await service.validateUserById(mockUser.id);

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should return null for invalid ID', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUserById('invalid-id');

      expect(result).toBeNull();
    });

    it('should query by user id', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.validateUserById('target-id');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'target-id' } }),
      );
    });
  });
});
