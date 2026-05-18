import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateInterviewAssignmentDto {
  @ApiProperty({ example: 1, description: '面試 ID (Interview.id)' })
  @IsNotEmpty()
  @IsInt()
  jobId: number;

  @ApiProperty({ example: 'uuid-string', description: '考生 User ID' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ example: 1, description: '題目 ID (Problem.id)' })
  @IsNotEmpty()
  @IsInt()
  problemId: number;
}
