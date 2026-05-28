import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ProblemsModule } from './problems/problems.module';
import { InterviewsModule } from './interviews/interviews.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { JudgeModule } from './judge/judge.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    ProblemsModule,
    InterviewsModule,
    AssignmentsModule,
    SubmissionsModule,
    JudgeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
