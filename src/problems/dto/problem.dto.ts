import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TestCaseDto {
  @ApiProperty({ example: '[1,2,3]' })
  @IsString()
  input: string;

  @ApiProperty({ example: '6' })
  @IsString()
  output: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_hidden?: boolean;
}

export class CreateProblemDto {
  @ApiProperty({ example: 'Two Sum' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Given an array of integers...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'EASY', enum: ['EASY', 'MEDIUM', 'HARD'] })
  @IsEnum(['EASY', 'MEDIUM', 'HARD'] as const)
  difficulty: string;

  @ApiPropertyOptional({ example: 1000, default: 1000 })
  @IsOptional()
  @IsInt()
  time_limit_ms?: number;

  @ApiPropertyOptional({ example: 256, default: 256 })
  @IsOptional()
  @IsInt()
  memory_limit_mb?: number;

  @ApiPropertyOptional({
    example: 'twoSum',
    description: '進入點 function 名稱',
  })
  @IsOptional()
  @IsString()
  function_name?: string;

  @ApiProperty({ type: [TestCaseDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  test_cases: TestCaseDto[];
}

export class UpdateProblemDto {
  @ApiPropertyOptional({ example: 'Two Sum' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 'Given an array of integers...' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ example: 'EASY', enum: ['EASY', 'MEDIUM', 'HARD'] })
  @IsOptional()
  @IsEnum(['EASY', 'MEDIUM', 'HARD'] as const)
  difficulty?: string;

  @ApiPropertyOptional({ example: 1000, default: 1000 })
  @IsOptional()
  @IsInt()
  time_limit_ms?: number;

  @ApiPropertyOptional({ example: 256, default: 256 })
  @IsOptional()
  @IsInt()
  memory_limit_mb?: number;

  @ApiPropertyOptional({
    example: 'twoSum',
    description: '進入點 function 名稱',
  })
  @IsOptional()
  @IsString()
  function_name?: string;

  @ApiPropertyOptional({ type: [TestCaseDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  test_cases?: TestCaseDto[];
}

export class AssignProblemDto {
  @ApiProperty({ example: 'alice' })
  @IsString()
  @IsNotEmpty()
  assignee_username: string;
}
