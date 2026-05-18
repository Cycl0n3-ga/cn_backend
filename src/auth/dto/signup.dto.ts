import { IsString, IsNotEmpty, IsEmail, IsOptional, IsHash } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupDto {
  @ApiProperty({ example: 'alice', description: '使用者名稱（唯一）' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'alice@example.com', description: '電子郵件（唯一）' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example:
      'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446',
    description: '密碼的 SHA-256 hex（前端送 sha256 後的值）',
  })
  @IsString()
  @IsNotEmpty()
  @IsHash('sha256')
  passwordSha256: string;

  @ApiPropertyOptional({ example: 'USER', enum: ['ADMIN', 'USER'], description: '角色，預設 USER' })
  @IsOptional()
  @IsString()
  role?: string;
}
