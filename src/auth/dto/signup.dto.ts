import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  IsHash,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { DEFAULT_USER_ROLE, UserRole, USER_ROLES } from '../user-role.js';

export class SignupDto {
  @ApiProperty({ example: 'alice', description: '使用者名稱（唯一）' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({
    example: null,
    description: '電子郵件（唯一）。CANDIDATE 可省略',
    nullable: true,
  })
  @ValidateIf((dto: SignupDto) => {
    const role = dto.role ?? DEFAULT_USER_ROLE;
    return role !== UserRole.CANDIDATE || dto.email != null;
  })
  @IsEmail()
  @IsNotEmpty()
  email?: string | null;

  @ApiProperty({
    example: 'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446',
    description: '密碼的 SHA-256 hex（前端送 sha256 後的值）',
  })
  @IsString()
  @IsNotEmpty()
  @IsHash('sha256')
  passwordSha256: string;

  @ApiPropertyOptional({
    example: 'CANDIDATE',
    enum: USER_ROLES,
    description: '角色，預設 CANDIDATE',
  })
  @IsOptional()
  @Transform(({ value }: TransformFnParams): string | undefined => {
    if (value == null || value === '') {
      return undefined;
    }
    return String(value).toUpperCase();
  })
  @IsIn(USER_ROLES)
  role?: UserRole;
}
