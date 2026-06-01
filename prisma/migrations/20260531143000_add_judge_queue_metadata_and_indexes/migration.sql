-- Add durable judge queue metadata to submissions.
ALTER TABLE "submissions" ADD COLUMN "judgeJobId" TEXT;
ALTER TABLE "submissions" ADD COLUMN "queuedAt" DATETIME;
ALTER TABLE "submissions" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "submissions" ADD COLUMN "finishedAt" DATETIME;
ALTER TABLE "submissions" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "submissions" ADD COLUMN "lastError" TEXT;

-- Query paths used by recovery, queue observability, leaderboard and assignment lookup.
CREATE INDEX "submissions_status_createdAt_idx" ON "submissions"("status", "createdAt");
CREATE INDEX "submissions_judgeJobId_idx" ON "submissions"("judgeJobId");
CREATE INDEX "users_role_rating_solvedCount_idx" ON "users"("role", "rating", "solvedCount");
CREATE INDEX "interview_assignments_userId_idx" ON "interview_assignments"("userId");
CREATE INDEX "interview_assignments_jobId_idx" ON "interview_assignments"("jobId");
