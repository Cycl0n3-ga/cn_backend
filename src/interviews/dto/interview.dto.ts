import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateInterviewDto {
  @ApiProperty({ example: 'Backend Developer', description: '面試職位名稱' })
  @IsNotEmpty()
  @IsString()
  jobRole: string;

  @ApiProperty({ example: 'uuid-string', description: '面試官 User ID' })
  @IsNotEmpty()
  @IsString()
  examinerEmpId: string;
}

export class UpdateInterviewDto {
  @ApiPropertyOptional({
    example: 'Senior Backend Developer',
    description: '面試職位名稱',
  })
  @IsOptional()
  @IsString()
  jobRole?: string;
}
