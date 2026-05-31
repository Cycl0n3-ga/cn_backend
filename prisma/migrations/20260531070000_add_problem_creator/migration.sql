-- AlterTable
ALTER TABLE "problems" ADD COLUMN "creatorId" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "problems_creatorId_idx" ON "problems"("creatorId");
