require("dotenv/config");
const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function getMockDbPath() {
  if (process.env.MOCK_DB_PATH) {
    return process.env.MOCK_DB_PATH;
  }

  return path.resolve(
    process.cwd(),
    "..",
    "online_code_test",
    "src",
    "data",
    "mockDb.json",
  );
}

async function main() {
  const defaultSeedPassword = "cloudnativedevelopment";
  const defaultPasswordHash = await bcrypt.hash(defaultSeedPassword, 10);
  const mockDbPath = getMockDbPath();
  const raw = fs.readFileSync(mockDbPath, "utf-8");
  const data = JSON.parse(raw);

  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.interviewCandidate.deleteMany();
  await prisma.question.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.user.deleteMany();

  if (data.users?.length) {
    const usersWithPasswordHash = data.users.map((user) => ({
      ...user,
      passwordHash: user.passwordHash ?? defaultPasswordHash,
    }));
    await prisma.user.createMany({ data: usersWithPasswordHash });
  }

  if (data.interviews?.length) {
    await prisma.interview.createMany({ data: data.interviews });
  }

  if (data.interviewCandidates?.length) {
    await prisma.interviewCandidate.createMany({ data: data.interviewCandidates });
  }

  if (data.questions?.length) {
    await prisma.question.createMany({ data: data.questions });
  }

  if (data.assignments?.length) {
    await prisma.assignment.createMany({ data: data.assignments });
  }

  if (data.submissions?.length) {
    await prisma.submission.createMany({ data: data.submissions });
  }

  console.log(`Seeded database from ${mockDbPath}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed database", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
