import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';

type SignupBody = {
  email?: string;
  password?: string;
  role?: 'candidate' | 'examiner' | 'questioner' | 'admin';
  name?: string;
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('signup')
  signup(@Body() body: SignupBody) {
    const { email, password, role, name } = body;
    if (!email || !password || !role) {
      throw new BadRequestException('email, password, and role are required.');
    }
    return this.usersService.create({ email, password, role, name });
  }

  @Post('login')
  login(@Body('email') email: string, @Body('password') password: string) {
    if (!email || !password) {
      throw new BadRequestException('email and password are required.');
    }
    return this.usersService.login(email, password);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
