import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Auth 規格：前端傳入 sha256(password) 的 64 位 hex 字串。
  async login(username: string, passwordSha256: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const isValid = await bcrypt.compare(passwordSha256, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      expires_in: parseInt(process.env.JWT_EXPIRES_IN || '3600', 10).toString(),
      user_role: user.role,
    };
  }

  async signup(data: {
    username: string;
    email: string;
    // sha256(password) 的 64 位 hex 字串
    passwordSha256: string;
    role?: string;
  }) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Username or email already exists.');
    }

    // 後端只儲存 bcrypt(sha256(password))
    const passwordHash = await bcrypt.hash(data.passwordSha256, 10);

    const user = await this.prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        role: data.role || 'USER',
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async validateUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
      },
    });
  }
}
