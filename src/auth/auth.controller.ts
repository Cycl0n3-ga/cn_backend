import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { SignupDto } from './dto/signup.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: process.env.NODE_ENV === 'production' ? 5 : 100, ttl: 60000 } }) // 5 attempts per minute — brute-force protection
  @ApiOperation({
    summary: '使用者登入',
    description: '驗證帳號密碼並核發 JWT Token',
  })
  @ApiResponse({
    status: 200,
    description: '登入成功',
    schema: {
      example: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expires_in: '3600',
        user_role: 'CANDIDATE',
      },
    },
  })
  @ApiResponse({ status: 401, description: '帳號或密碼錯誤' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.passwordSha256);
  }

  @Post('signup')
  @ApiOperation({ summary: '使用者註冊', description: '建立新使用者帳號' })
  @ApiResponse({ status: 201, description: '註冊成功' })
  @ApiResponse({ status: 409, description: '帳號或信箱已存在' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup({
      username: dto.username,
      email: dto.email,
      passwordSha256: dto.passwordSha256,
      role: dto.role,
    });
  }
}
