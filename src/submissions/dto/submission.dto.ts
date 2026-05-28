import { IsString, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubmissionDto {
  @ApiProperty({ example: 1, description: '題目 ID' })
  @IsInt()
  problem_id: number;

  @ApiProperty({ example: 'python', enum: ['javascript', 'python', 'c', 'cpp'] })
  @IsString()
  @IsNotEmpty()
  language: string;

  @ApiProperty({
    example: 'def twoSum(nums, target):\n    pass',
    description: '原始碼',
  })
  @IsString()
  @IsNotEmpty()
  source_code: string;
}
