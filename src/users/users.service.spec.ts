import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  const mockUsers = [
    {
      id: 'uuid-1',
      username: 'alice',
      email: null,
      role: 'CANDIDATE',
      solvedCount: 3,
      rating: 1500,
      createdAt: new Date('2026-05-01T00:00:00Z'),
    },
    {
      id: 'uuid-2',
      username: 'bob',
      email: null,
      role: 'CANDIDATE',
      solvedCount: 5,
      rating: 1800,
      createdAt: new Date('2026-05-02T00:00:00Z'),
    },
  ];

  const mockSubmissions = [
    {
      id: 'sub-1',
      problemId: 1,
      language: 'python3',
      status: 'ACCEPTED',
      score: 100,
      sourceCode: 'def twoSum(): pass',
      userOutput: '[0,1]',
      createdAt: new Date('2026-05-13T12:00:00Z'),
    },
    {
      id: 'sub-2',
      problemId: 2,
      language: 'cpp',
      status: 'WRONG_ANSWER',
      score: 0,
      sourceCode: '#include <iostream>',
      userOutput: null,
      createdAt: new Date('2026-05-13T11:00:00Z'),
    },
  ];

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      submission: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all users in data array', async () => {
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(2);
    });

    it('should map user fields correctly', async () => {
      prisma.user.findMany.mockResolvedValue([mockUsers[0]]);

      const result = await service.findAll();

      expect(result.data[0]).toMatchObject({
        id: 'uuid-1',
        username: 'alice',
        email: null,
        role: 'CANDIDATE',
      });
    });

    it('should return numeric fields as strings', async () => {
      prisma.user.findMany.mockResolvedValue([mockUsers[0]]);

      const result = await service.findAll();

      expect(typeof result.data[0].solvedCount).toBe('string');
      expect(typeof result.data[0].rating).toBe('string');
      expect(result.data[0].solvedCount).toBe('3');
      expect(result.data[0].rating).toBe('1500');
    });

    it('should not expose passwordHash', async () => {
      const userWithHash = { ...mockUsers[0], passwordHash: 'bcrypt-hash' };
      prisma.user.findMany.mockResolvedValue([userWithHash]);

      const result = await service.findAll();

      expect(result.data[0]).not.toHaveProperty('passwordHash');
    });

    it('should return empty array when no users exist', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(0);
    });

    it('should include createdAt timestamp', async () => {
      prisma.user.findMany.mockResolvedValue([mockUsers[0]]);

      const result = await service.findAll();

      expect(result.data[0]).toHaveProperty('createdAt');
    });
  });

  // ── getSubmissionHistory ──────────────────────────────────────────────
  describe('getSubmissionHistory', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        username: 'alice',
      });
      prisma.submission.count.mockResolvedValue(2);
      prisma.submission.findMany.mockResolvedValue(mockSubmissions);
    });

    it('should return submission history with total and page', async () => {
      const result = await service.getSubmissionHistory('alice', 1, 20);

      expect(result).toHaveProperty('total', '2');
      expect(result).toHaveProperty('page', '1');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(2);
    });

    it('should return all required submission fields', async () => {
      const result = await service.getSubmissionHistory('alice', 1, 20);

      const submission = result.data[0];
      expect(submission).toHaveProperty('submission_id', 'sub-1');
      expect(submission).toHaveProperty('problem_id', '1');
      expect(submission).toHaveProperty('language', 'python3');
      expect(submission).toHaveProperty('status', 'ACCEPTED');
      expect(submission).toHaveProperty('score', '100');
      expect(submission).toHaveProperty('source_code');
      expect(submission).toHaveProperty('execution_result');
      expect(submission).toHaveProperty('submitted_at');
    });

    it('should return score as string', async () => {
      const result = await service.getSubmissionHistory('alice', 1, 20);

      expect(typeof result.data[0].score).toBe('string');
    });

    it('should return problem_id as string', async () => {
      const result = await service.getSubmissionHistory('alice', 1, 20);

      expect(typeof result.data[0].problem_id).toBe('string');
    });

    it('should return empty string for execution_result when userOutput is null', async () => {
      const result = await service.getSubmissionHistory('alice', 1, 20);

      const waSubmission = result.data.find((s) => s.status === 'WRONG_ANSWER');
      expect(waSubmission?.execution_result).toBe('');
    });

    it('should look up user by username', async () => {
      await service.getSubmissionHistory('alice', 1, 20);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'alice' },
      });
    });

    it('should use correct pagination (page, limit)', async () => {
      prisma.submission.count.mockResolvedValue(50);
      prisma.submission.findMany.mockResolvedValue([]);

      await service.getSubmissionHistory('alice', 3, 10);

      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
    });

    it('should return correct page number as string', async () => {
      const result = await service.getSubmissionHistory('alice', 2, 20);

      expect(result.page).toBe('2');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getSubmissionHistory('nonexistent', 1, 20),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException with username in message', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getSubmissionHistory('ghost')).rejects.toThrow(
        'User "ghost" not found.',
      );
    });

    it('should default page to 1 and limit to 20', async () => {
      await service.getSubmissionHistory('alice');

      expect(prisma.submission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });
});
