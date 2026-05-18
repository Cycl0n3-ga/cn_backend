import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { ProblemsModule } from './problems/problems.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';
import { HealthModule } from './health/health.module.js';
import { InternalModule } from './internal/internal.module.js';
import { InterviewsModule } from './interviews/interviews.module.js';
import { InterviewCandidatesModule } from './interview-candidates/interview-candidates.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ProblemsModule,
    SubmissionsModule,
    LeaderboardModule,
    HealthModule,
    InternalModule,
    InterviewsModule,
    InterviewCandidatesModule,
    AssignmentsModule,
  ],
})
export class AppModule {}
