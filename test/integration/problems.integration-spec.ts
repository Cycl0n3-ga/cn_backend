import { Test, TestingModule } from '@nestjs/testing';
import { ProblemsModule } from '../../src/problems/problems.module';
import { ProblemsService } from '../../src/problems/problems.service';
import { NotFoundException } from '@nestjs/common';

describe('ProblemsService (integration)', () => {
  let moduleRef: TestingModule;
  let problemsService: ProblemsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ProblemsModule],
    }).compile();

    problemsService = moduleRef.get(ProblemsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('findAll should return seeded problems with string numeric fields', async () => {
    const res = await problemsService.findAll(1, 20);

    expect(res.total).toBe('5');
    expect(res.page).toBe('1');
    expect(Array.isArray(res.items)).toBe(true);
    expect(res.items.length).toBeGreaterThan(0);

    const first = res.items[0];
    expect(typeof first.problem_id).toBe('string');
    expect(typeof first.acceptance_rate).toBe('string');
    expect(typeof first.assignedCount).toBe('string');
    expect(typeof first.submittedCount).toBe('string');
    expect(typeof first.acceptedCount).toBe('string');
    expect(typeof first.failedCount).toBe('string');
    expect(first.creator).toMatchObject({
      username: 'questioner',
      email: 'questioner@codejudge.dev',
    });
  });

  it('findAll should filter by difficulty', async () => {
    const res = await problemsService.findAll(1, 50, 'EASY');

    for (const item of res.items) {
      expect(item.difficulty).toBe('EASY');
    }
  });

  it('findOne should exclude hidden testcases from sample_test_cases (seeded Two Sum)', async () => {
    const detail = await problemsService.findOne(1);

    expect(detail.problem_id).toBe('1');
    expect(detail.sample_test_cases.length).toBe(2);
    expect(detail.creator).toMatchObject({
      username: 'questioner',
      email: 'questioner@codejudge.dev',
    });
    expect(detail).toMatchObject({
      assignedCount: '1',
      submittedCount: '2',
      acceptedCount: '1',
      failedCount: '1',
    });
  });

  it('findOne should throw NotFoundException for deleted/non-existent problems', async () => {
    await expect(problemsService.findOne(99999)).rejects.toThrow(
      NotFoundException,
    );
  });
});
