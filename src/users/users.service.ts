import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';

type SignupRole = 'candidate' | 'examiner' | 'questioner' | 'admin';

type SignupInput = {
  email: string;
  password: string;
  role: SignupRole;
  name?: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private mapRoleFlags(role: SignupRole) {
    return {
      isCandidate: role === 'candidate',
      isExaminer: role === 'examiner',
      isQuestioner: role === 'questioner',
      isAdmin: role === 'admin',
    };
  }

  private buildEmpId(role: SignupRole) {
    if (role === 'candidate') return null;
    return Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, '0');
  }

  async create(input: SignupInput) {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();
    const name = input.name?.trim() || email.split('@')[0];

    if (!email || !password || !input.role) {
      throw new BadRequestException('email, password, and role are required.');
    }

    const existed = await this.prisma.user.findUnique({ where: { email } });
    if (existed) {
      throw new ConflictException('Email is already registered.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        empId: this.buildEmpId(input.role),
        ...this.mapRoleFlags(input.role),
      },
      select: {
        id: true,
        email: true,
        name: true,
        empId: true,
        isAdmin: true,
        isCandidate: true,
        isExaminer: true,
        isQuestioner: true,
      },
    });

    return user;
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      empId: user.empId,
      isAdmin: user.isAdmin,
      isCandidate: user.isCandidate,
      isExaminer: user.isExaminer,
      isQuestioner: user.isQuestioner,
    };
  }

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        empId: true,
        isAdmin: true,
        isCandidate: true,
        isExaminer: true,
        isQuestioner: true,
      },
      orderBy: { id: 'asc' },
    });
  }
}
