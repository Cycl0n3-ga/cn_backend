import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateInterviewCandidateDto {
  @ApiProperty({ example: 1, description: '面試 ID' })
  @IsNotEmpty()
  @IsInt()
  jobId: number;

  @ApiProperty({ example: 'uuid-string', description: '面試者 User ID' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    example: 1770000000,
    description: '測驗開始時間（Unix timestamp seconds）',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  startTime?: number | null;

  @ApiPropertyOptional({
    example: 1770003600,
    description: '測驗結束時間（Unix timestamp seconds）',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  endTime?: number | null;
}

export class UpdateInterviewCandidateTimeDto {
  @ApiPropertyOptional({
    example: 1770000000,
    description: '測驗開始時間（Unix timestamp seconds）。傳 null 可清除',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  startTime?: number | null;

  @ApiPropertyOptional({
    example: 1770003600,
    description: '測驗結束時間（Unix timestamp seconds）。傳 null 可清除',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  endTime?: number | null;
}
