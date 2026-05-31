import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
});
const prisma = new PrismaClient({ adapter });

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.interviewCandidate.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.testCase.deleteMany();
  await prisma.problem.deleteMany();
  await prisma.user.deleteMany();

  // Reset SQLite AUTOINCREMENT counters so IDs start from 1.
  // (SQLite keeps increasing rowids across deleteMany unless sqlite_sequence is cleared.)
  await prisma.$executeRawUnsafe('DELETE FROM sqlite_sequence;');

  // ─── Users ───────────────────────────────────────
  // Auth 規格：前端傳 sha256(password) 的 hex 字串；後端以 bcrypt 儲存。
  const adminHash = await bcrypt.hash(sha256Hex('admin123'), 10);
  const userHash = await bcrypt.hash(sha256Hex('user123'), 10);

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@codejudge.dev',
      passwordHash: adminHash,
      role: 'ADMIN',
      solvedCount: 0,
      rating: 0,
    },
  });

  const alice = await prisma.user.create({
    data: {
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: userHash,
      role: 'USER',
      solvedCount: 3,
      rating: 1500,
    },
  });

  const bob = await prisma.user.create({
    data: {
      username: 'bob',
      email: 'bob@example.com',
      passwordHash: userHash,
      role: 'USER',
      solvedCount: 5,
      rating: 1800,
    },
  });

  console.log(`  ✓ Created ${3} users`);

  // ─── Problems ────────────────────────────────────
  const twoSum = await prisma.problem.create({
    data: {
      title: 'Two Sum',
      description: `## Two Sum\n\nGiven an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.\n\nYou may assume that each input would have **exactly one solution**, and you may not use the same element twice.\n\n### Example 1:\n\`\`\`\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n\`\`\`\n\n### Constraints:\n- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9`,
      difficulty: 'EASY',
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      acceptanceRate: 0.49,
      creatorId: admin.id,
    },
  });

  const addTwoNumbers = await prisma.problem.create({
    data: {
      title: 'Add Two Numbers',
      description: `## Add Two Numbers\n\nYou are given two non-empty linked lists representing two non-negative integers.\n\n### Example 1:\n\`\`\`\nInput: l1 = [2,4,3], l2 = [5,6,4]\nOutput: [7,0,8]\n\`\`\``,
      difficulty: 'MEDIUM',
      timeLimitMs: 2000,
      memoryLimitMb: 256,
      acceptanceRate: 0.39,
      creatorId: admin.id,
    },
  });

  const medianSorted = await prisma.problem.create({
    data: {
      title: 'Median of Two Sorted Arrays',
      description: `## Median of Two Sorted Arrays\n\nGiven two sorted arrays nums1 and nums2, return the median of the two sorted arrays.\n\n### Example 1:\n\`\`\`\nInput: nums1 = [1,3], nums2 = [2]\nOutput: 2.00000\n\`\`\``,
      difficulty: 'HARD',
      timeLimitMs: 3000,
      memoryLimitMb: 512,
      acceptanceRate: 0.35,
      creatorId: admin.id,
    },
  });

  const reverseString = await prisma.problem.create({
    data: {
      title: 'Reverse String',
      description: `## Reverse String\n\nWrite a function that reverses a string.\n\n### Example 1:\n\`\`\`\nInput: s = ["h","e","l","l","o"]\nOutput: ["o","l","l","e","h"]\n\`\`\``,
      difficulty: 'EASY',
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      acceptanceRate: 0.75,
      creatorId: admin.id,
    },
  });

  const maxSubarray = await prisma.problem.create({
    data: {
      title: 'Maximum Subarray',
      description: `## Maximum Subarray\n\nGiven an integer array nums, find the subarray with the largest sum, and return its sum.\n\n### Example 1:\n\`\`\`\nInput: nums = [-2,1,-3,4,-1,2,1,-5,4]\nOutput: 6\n\`\`\``,
      difficulty: 'MEDIUM',
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      acceptanceRate: 0.5,
      creatorId: admin.id,
    },
  });

  console.log(`  ✓ Created 5 problems`);

  // ─── Test Cases ──────────────────────────────────
  await prisma.testCase.createMany({
    data: [
      {
        problemId: twoSum.id,
        input: '[2,7,11,15]\n9',
        output: '[0,1]',
        isHidden: false,
      },
      {
        problemId: twoSum.id,
        input: '[3,2,4]\n6',
        output: '[1,2]',
        isHidden: false,
      },
      {
        problemId: twoSum.id,
        input: '[3,3]\n6',
        output: '[0,1]',
        isHidden: true,
      },
      {
        problemId: twoSum.id,
        input: '[1,5,8,3,9]\n4',
        output: '[0,3]',
        isHidden: true,
      },
    ],
  });

  await prisma.testCase.createMany({
    data: [
      {
        problemId: addTwoNumbers.id,
        input: '[2,4,3]\n[5,6,4]',
        output: '[7,0,8]',
        isHidden: false,
      },
      {
        problemId: addTwoNumbers.id,
        input: '[0]\n[0]',
        output: '[0]',
        isHidden: false,
      },
      {
        problemId: addTwoNumbers.id,
        input: '[9,9,9]\n[1]',
        output: '[0,0,0,1]',
        isHidden: true,
      },
    ],
  });

  await prisma.testCase.createMany({
    data: [
      {
        problemId: medianSorted.id,
        input: '[1,3]\n[2]',
        output: '2.00000',
        isHidden: false,
      },
      {
        problemId: medianSorted.id,
        input: '[1,2]\n[3,4]',
        output: '2.50000',
        isHidden: true,
      },
    ],
  });

  await prisma.testCase.createMany({
    data: [
      {
        problemId: reverseString.id,
        input: '["h","e","l","l","o"]',
        output: '["o","l","l","e","h"]',
        isHidden: false,
      },
      {
        problemId: reverseString.id,
        input: '["H","a","n","n","a","h"]',
        output: '["h","a","n","n","a","H"]',
        isHidden: true,
      },
    ],
  });

  await prisma.testCase.createMany({
    data: [
      {
        problemId: maxSubarray.id,
        input: '[-2,1,-3,4,-1,2,1,-5,4]',
        output: '6',
        isHidden: false,
      },
      { problemId: maxSubarray.id, input: '[1]', output: '1', isHidden: false },
      {
        problemId: maxSubarray.id,
        input: '[5,4,-1,7,8]',
        output: '23',
        isHidden: true,
      },
    ],
  });

  console.log(`  ✓ Created test cases for all problems`);

  // ─── Sample Submissions ──────────────────────────
  await prisma.submission.create({
    data: {
      userId: alice.id,
      problemId: twoSum.id,
      language: 'python3',
      sourceCode:
        'def twoSum(nums, target):\n    lookup = {}\n    for i, n in enumerate(nums):\n        if target - n in lookup:\n            return [lookup[target-n], i]\n        lookup[n] = i',
      status: 'ACCEPTED',
      score: 100,
      executionTimeMs: 45,
      memoryUsageKb: 2048,
    },
  });

  await prisma.submission.create({
    data: {
      userId: bob.id,
      problemId: twoSum.id,
      language: 'cpp',
      sourceCode:
        '#include <vector>\nusing namespace std;\nvector<int> twoSum(vector<int>& nums, int target) {\n    return {};\n}',
      status: 'WRONG_ANSWER',
      score: 0,
      executionTimeMs: 12,
      memoryUsageKb: 1024,
    },
  });

  await prisma.submission.create({
    data: {
      userId: bob.id,
      problemId: addTwoNumbers.id,
      language: 'python3',
      sourceCode: 'def addTwoNumbers(l1, l2):\n    pass',
      status: 'ACCEPTED',
      score: 100,
      executionTimeMs: 68,
      memoryUsageKb: 3072,
    },
  });

  console.log(`  ✓ Created sample submissions`);

  // ─── Assignments ─────────────────────────────────
  await prisma.assignment.create({
    data: { problemId: twoSum.id, userId: alice.id },
  });

  await prisma.assignment.create({
    data: { problemId: addTwoNumbers.id, userId: bob.id },
  });

  console.log(`  ✓ Created sample assignments`);
  console.log('\n✅ Database seeded successfully!');
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed database:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
