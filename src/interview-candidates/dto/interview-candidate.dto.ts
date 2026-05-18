import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreateInterviewCandidateDto {
  @ApiProperty({ example: 1, description: '面試 ID' })
  @IsNotEmpty()
  @IsInt()
  jobId: number;

  @ApiProperty({ example: 'uuid-string', description: '面試者 User ID' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}
