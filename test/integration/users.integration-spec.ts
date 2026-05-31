import { Test, TestingModule } from '@nestjs/testing';
import { UsersModule } from '../../src/users/users.module';
import { UsersService } from '../../src/users/users.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService (integration)', () => {
  let moduleRef: TestingModule;
  let usersService: UsersService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [UsersModule],
    }).compile();

    usersService = moduleRef.get(UsersService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('findAll should include seeded users and return numeric fields as strings', async () => {
    const res = await usersService.findAll();

    expect(res.data).toHaveLength(5);

    const admin = res.data.find((u) => u.username === 'admin');
    expect(admin).toBeTruthy();
    expect(admin).toMatchObject({ role: 'ADMIN' });

    const examiner = res.data.find((u) => u.username === 'examiner');
    expect(examiner).toMatchObject({ role: 'EXAMINER' });

    const questioner = res.data.find((u) => u.username === 'questioner');
    expect(questioner).toMatchObject({ role: 'QUESTIONER' });

    const alice = res.data.find((u) => u.username === 'alice');
    expect(alice).toMatchObject({ role: 'CANDIDATE', email: null });

    for (const u of res.data) {
      expect(typeof u.solvedCount).toBe('string');
      expect(typeof u.rating).toBe('string');
    }
  });

  it('getSubmissionHistory should return seeded history for bob', async () => {
    const res = await usersService.getSubmissionHistory('bob', 1, 20);

    expect(res.total).toBe('2');
    expect(res.page).toBe('1');
    expect(Array.isArray(res.data)).toBe(true);

    for (const s of res.data) {
      expect(typeof s.problem_id).toBe('string');
      expect(typeof s.score).toBe('string');
      expect(typeof s.submission_id).toBe('string');
    }
  });

  it('getSubmissionHistory should throw NotFoundException for non-existent user', async () => {
    await expect(
      usersService.getSubmissionHistory('no_such_user_xyz'),
    ).rejects.toThrow(NotFoundException);
  });
});
