import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class InterviewProblemCountsDto {
  @ApiPropertyOptional({
    example: 2,
    default: 0,
    description: '要指派的 EASY 題數',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  easy?: number;

  @ApiPropertyOptional({
    example: 1,
    default: 0,
    description: '要指派的 MEDIUM 題數',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  medium?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    description: '要指派的 HARD 題數',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hard?: number;
}

export class CreateInterviewDto {
  @ApiProperty({ example: 'Backend Developer', description: '面試職位名稱' })
  @IsNotEmpty()
  @IsString()
  jobRole: string;

  @ApiPropertyOptional({
    example: 'uuid-string',
    description: '面試者 User ID；提供後會一併新增為此面試的候選人',
  })
  @IsOptional()
  @IsString()
  candidateUserId?: string;

  @ApiPropertyOptional({
    type: InterviewProblemCountsDto,
    description: '建立面試時要自動指派給候選人的各難度題數',
    example: { easy: 2, medium: 1, hard: 0 },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => InterviewProblemCountsDto)
  problemCounts?: InterviewProblemCountsDto;
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
