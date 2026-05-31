import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from '../../src/auth/auth.module';
import { AuthService } from '../../src/auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

describe('AuthService (integration)', () => {
  let moduleRef: TestingModule;
  let authService: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    authService = moduleRef.get(AuthService);
    prisma = moduleRef.get(PrismaService);

    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await moduleRef.close();
  });

  it('should login with seeded admin user', async () => {
    const result = await authService.login('admin', sha256Hex('admin123'));

    expect(result.token).toEqual(expect.any(String));
    expect(result.user_role).toBe('ADMIN');
    expect(typeof result.expires_in).toBe('string');
  });

  it('should signup then login successfully (and cleanup)', async () => {
    const username = `itest_${Date.now()}`;
    const email = `${username}@example.com`;
    const passwordSha256 = sha256Hex('integration-pass-123');

    const created = await authService.signup({
      username,
      email,
      passwordSha256,
    });

    expect(created).toHaveProperty('id');
    expect(created).toHaveProperty('username', username);
    expect(created).toHaveProperty('email', email);
    expect(created).toHaveProperty('role', 'CANDIDATE');

    const login = await authService.login(username, passwordSha256);
    expect(login.token).toEqual(expect.any(String));
    expect(login.user_role).toBe('CANDIDATE');

    await prisma.user.delete({ where: { id: created.id } });
  });

  it('should throw ConflictException when username already exists', async () => {
    await expect(
      authService.signup({
        username: 'admin',
        email: `admin_${Date.now()}@example.com`,
        passwordSha256: sha256Hex('any'),
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw UnauthorizedException for wrong password', async () => {
    await expect(
      authService.login('admin', sha256Hex('wrong-password')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('validateUserById should return non-sensitive fields only', async () => {
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
    });
    expect(admin).toBeTruthy();

    const result = await authService.validateUserById(admin!.id);
    expect(result).toEqual(
      expect.objectContaining({
        id: admin!.id,
        username: 'admin',
        email: expect.any(String),
        role: 'ADMIN',
      }),
    );

    expect((result as any).passwordHash).toBeUndefined();
  });
});
