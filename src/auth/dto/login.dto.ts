import { IsString, IsNotEmpty, IsHash } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: '使用者帳號' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    description: '使用者密碼的 SHA-256 hex（前端送 sha256 後的值）',
  })
  @IsString()
  @IsNotEmpty()
  @IsHash('sha256')
  passwordSha256: string;
}
