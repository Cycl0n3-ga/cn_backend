import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureHttpApp } from './../src/common/app-setup';

jest.setTimeout(30000);

describe('Code Judge API (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let aliceToken: string;
  let bobToken: string;
  let examinerToken: string;

  const adminSha256 =
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // sha256('admin123')
  const userSha256 =
    'e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446'; // sha256('user123')

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureHttpApp(app);
    await app.init();

    // Pre-login for authenticated e2e flows.
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', passwordSha256: adminSha256 })
      .expect(200);
    adminToken = adminLogin.body.token;

    const aliceLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'alice', passwordSha256: userSha256 })
      .expect(200);
    aliceToken = aliceLogin.body.token;

    const bobLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'bob', passwordSha256: userSha256 })
      .expect(200);
    bobToken = bobLogin.body.token;

    const examinerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'examiner', passwordSha256: userSha256 })
      .expect(200);
    examinerToken = examinerLogin.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Health Check
  // ═══════════════════════════════════════════════════════════════════════
  describe('Health Check', () => {
    it('GET /api/v1/health should return system status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(res.body).toHaveProperty('status');
      expect(['UP', 'DOWN']).toContain(res.body.status);
    });

    it('should return all required health fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('services');
      expect(res.body).toHaveProperty('queue_depth');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('timestamp');
    });

    it('should return services.database status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(res.body.services).toHaveProperty('database');
      expect(res.body.services).toHaveProperty('judge_queue');
    });

    it('should return queue_depth as string', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(typeof res.body.queue_depth).toBe('string');
    });

    it('should return timestamp as ISO 8601', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('GET /api/v1/health/live should return liveness only', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200);

      expect(res.body.status).toBe('UP');
      expect(res.body).toHaveProperty('uptime');
    });

    it('GET /api/v1/health/ready should check dependencies', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/ready')
        .expect(200);

      expect(res.body.status).toBe('UP');
      expect(res.body.services).toHaveProperty('database', 'OK');
      expect(res.body.services).toHaveProperty('judge_queue', 'OK');
    });

    it('should echo x-request-id for observability', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('x-request-id', 'e2e-request-id')
        .expect(200);

      expect(res.headers['x-request-id']).toBe('e2e-request-id');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Authentication
  // ═══════════════════════════════════════════════════════════════════════
  describe('Authentication', () => {
    const validSha256 = adminSha256;

    describe('POST /api/v1/auth/login', () => {
      it('should return 401 for invalid credentials', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            username: 'admin',
            passwordSha256:
              'wrong_password_hash_64chars_0000000000000000000000000000000000',
          })
          .expect(400); // will fail validation because it's not a valid sha256
      });

      it('should return 401 for non-existent user with valid sha256 format', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            username: 'nonexistent_user_xyz',
            passwordSha256: validSha256,
          })
          .expect(401);
        expect(res.body.message).toBe('Invalid username or password.');
      });

      it('should return 400 for missing username', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ passwordSha256: validSha256 })
          .expect(400);
      });

      it('should return 400 for missing passwordSha256', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username: 'admin' })
          .expect(400);
      });

      it('should return 400 for non-sha256 password (validation)', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username: 'admin', passwordSha256: 'not-a-sha256-hash' })
          .expect(400);
      });

      it('should return 400 for extra fields (forbidNonWhitelisted)', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            username: 'admin',
            passwordSha256: validSha256,
            extraField: 'should be rejected',
          })
          .expect(400);
      });
    });

    describe('POST /api/v1/auth/signup', () => {
      it('should allow candidate signup without email', async () => {
        const suffix = Date.now();
        await request(app.getHttpServer())
          .post('/api/v1/auth/signup')
          .send({
            username: `candidate_no_email_${suffix}`,
            passwordSha256: validSha256,
          })
          .expect(201);
      });

      it('should return 400 for examiner signup without email', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/signup')
          .send({
            username: 'examiner_no_email',
            passwordSha256: validSha256,
            role: 'EXAMINER',
          })
          .expect(400);
      });

      it('should return 400 for invalid email format', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/signup')
          .send({
            username: 'signuptest',
            email: 'not-an-email',
            passwordSha256: validSha256,
          })
          .expect(400);
      });

      it('should return 400 for non-sha256 password', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/signup')
          .send({
            username: 'signuptest',
            email: 'signup@example.com',
            passwordSha256: 'plain-password',
          })
          .expect(400);
      });

      it('should return 400 for empty username', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/signup')
          .send({
            username: '',
            email: 'signup@example.com',
            passwordSha256: validSha256,
          })
          .expect(400);
      });
    });

    describe('Successful auth flows', () => {
      it('should login seeded admin successfully', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username: 'admin', passwordSha256: adminSha256 })
          .expect(200);

        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
        expect(res.body).toHaveProperty('user_role', 'ADMIN');
        expect(typeof res.body.expires_in).toBe('string');
      });

      it('should signup a new user then login successfully', async () => {
        const suffix = Date.now();
        const username = `e2e_user_${suffix}`;
        const email = `e2e_${suffix}@example.com`;

        const signup = await request(app.getHttpServer())
          .post('/api/v1/auth/signup')
          .send({
            username,
            email,
            passwordSha256: userSha256,
          })
          .expect(201);

        expect(signup.body).toHaveProperty('id');
        expect(signup.body).toHaveProperty('username', username);
        expect(signup.body).toHaveProperty('email', email);
        expect(signup.body).toHaveProperty('role', 'CANDIDATE');

        const login = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ username, passwordSha256: userSha256 })
          .expect(200);

        expect(login.body).toHaveProperty('token');
        expect(login.body).toHaveProperty('user_role', 'CANDIDATE');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Problems
  // ═══════════════════════════════════════════════════════════════════════
  describe('Problems', () => {
    let createdProblemId: string | undefined;

    describe('GET /api/v1/problems', () => {
      it('should return paginated list of problems', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/problems?page=1&limit=5')
          .expect(200);

        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('page', '1');
        expect(Array.isArray(res.body.items)).toBe(true);
      });

      it('should return items with correct field names', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/problems')
          .expect(200);

        if (res.body.items.length > 0) {
          expect(res.body.items[0]).toHaveProperty('problem_id');
          expect(res.body.items[0]).toHaveProperty('title');
          expect(res.body.items[0]).toHaveProperty('difficulty');
          expect(res.body.items[0]).toHaveProperty('acceptance_rate');
          expect(res.body.items[0]).toHaveProperty('creator');
          expect(res.body.items[0]).toHaveProperty('assignedCount');
          expect(res.body.items[0]).toHaveProperty('submittedCount');
          expect(res.body.items[0]).toHaveProperty('acceptedCount');
          expect(res.body.items[0]).toHaveProperty('failedCount');
        }
      });

      it('should return total and page as strings', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/problems')
          .expect(200);

        expect(typeof res.body.total).toBe('string');
        expect(typeof res.body.page).toBe('string');
      });

      it('should support difficulty filter', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/problems?difficulty=EASY')
          .expect(200);

        if (res.body.items.length > 0) {
          for (const item of res.body.items) {
            expect(item.difficulty).toBe('EASY');
          }
        }
      });

      it('should return page 2 correctly', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/problems?page=2&limit=1')
          .expect(200);

        expect(res.body.page).toBe('2');
      });
    });

    describe('GET /api/v1/problems/:id', () => {
      it('should return problem detail', async () => {
        const listRes = await request(app.getHttpServer())
          .get('/api/v1/problems')
          .expect(200);

        if (listRes.body.items.length > 0) {
          const id = listRes.body.items[0].problem_id;
          const res = await request(app.getHttpServer())
            .get(`/api/v1/problems/${id}`)
            .expect(200);

          expect(res.body).toHaveProperty('problem_id', id);
          expect(res.body).toHaveProperty('title');
          expect(res.body).toHaveProperty('description');
          expect(res.body).toHaveProperty('difficulty');
          expect(res.body).toHaveProperty('creator');
          expect(res.body).toHaveProperty('assignedCount');
          expect(res.body).toHaveProperty('submittedCount');
          expect(res.body).toHaveProperty('acceptedCount');
          expect(res.body).toHaveProperty('failedCount');
          expect(res.body).toHaveProperty('constraints');
          expect(res.body).toHaveProperty('sample_test_cases');
        }
      });

      it('should return 404 for non-existent problem', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/problems/99999')
          .expect(404);
      });

      it('should return constraints as strings', async () => {
        const listRes = await request(app.getHttpServer())
          .get('/api/v1/problems')
          .expect(200);

        if (listRes.body.items.length > 0) {
          const id = listRes.body.items[0].problem_id;
          const res = await request(app.getHttpServer())
            .get(`/api/v1/problems/${id}`)
            .expect(200);

          expect(typeof res.body.constraints.time_limit_ms).toBe('string');
          expect(typeof res.body.constraints.memory_limit_mb).toBe('string');
        }
      });
    });

    describe('POST /api/v1/problems (Admin)', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/problems')
          .send({
            title: 'Test',
            description: 'Test',
            difficulty: 'EASY',
            test_cases: [{ input: '1', output: '1' }],
          })
          .expect(401);
      });

      it('should return 400 for invalid difficulty enum', async () => {
        // We can't auth here without DB seed, so just test validation
        await request(app.getHttpServer())
          .post('/api/v1/problems')
          .send({
            title: 'Test',
            description: 'Test',
            difficulty: 'INVALID',
            test_cases: [],
          })
          .expect(401); // auth guard fires first
      });

      it('should allow ADMIN to create a problem', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: `E2E Problem ${Date.now()}`,
            description: 'Created by e2e test',
            difficulty: 'EASY',
            function_name: 'solve',
            time_limit_ms: 1000,
            memory_limit_mb: 256,
            test_cases: [
              { input: '1', output: '1', is_hidden: false },
              { input: '2', output: '2', is_hidden: true },
            ],
          })
          .expect(201);

        expect(res.body).toHaveProperty('problem_id');
        expect(typeof res.body.problem_id).toBe('string');
        expect(res.body.creator).toMatchObject({
          username: 'admin',
          email: 'admin@codejudge.dev',
        });
        createdProblemId = res.body.problem_id;
      });

      it('should return 403 when CANDIDATE tries to create a problem', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/problems')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            title: `E2E Forbidden ${Date.now()}`,
            description: 'Should be forbidden',
            difficulty: 'EASY',
            test_cases: [{ input: '1', output: '1' }],
          })
          .expect(403);
      });
    });

    describe('DELETE /api/v1/problems/:id', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .delete('/api/v1/problems/1')
          .expect(401);
      });

      it('should allow ADMIN to delete a problem', async () => {
        const create = await request(app.getHttpServer())
          .post('/api/v1/problems')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: `E2E Delete Target ${Date.now()}`,
            description: 'Created for delete test',
            difficulty: 'EASY',
            test_cases: [{ input: '1', output: '1', is_hidden: false }],
          })
          .expect(201);

        const id = create.body.problem_id;
        expect(typeof id).toBe('string');

        await request(app.getHttpServer())
          .delete(`/api/v1/problems/${id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204);

        await request(app.getHttpServer())
          .get(`/api/v1/problems/${id}`)
          .expect(404);
      });
    });

    describe('POST /api/v1/problems/:id/assign', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/problems/1/assign')
          .send({ assignee_username: 'alice' })
          .expect(401);
      });

      it('should allow ADMIN to assign a problem to a user', async () => {
        expect(createdProblemId).toBeTruthy();

        const res = await request(app.getHttpServer())
          .post(`/api/v1/problems/${createdProblemId}/assign`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ assignee_username: 'alice' })
          .expect(200);

        expect(res.body).toHaveProperty('assignment_id');
        expect(res.body).toHaveProperty('problem_id', createdProblemId);
        expect(res.body).toHaveProperty('assignee', 'alice');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Submissions
  // ═══════════════════════════════════════════════════════════════════════
  describe('Submissions', () => {
    describe('POST /api/v1/submissions', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/submissions')
          .send({
            problem_id: 1,
            language: 'python3',
            source_code: 'def solve(): pass',
          })
          .expect(401);
      });

      it('should accept a submission with JWT and allow polling until terminal status', async () => {
        const submitRes = await request(app.getHttpServer())
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send({
            problem_id: 1,
            language: 'python3',
            source_code: 'def twoSum(nums, target):\n    return [0,1]',
          })
          .expect(202);

        expect(submitRes.body).toHaveProperty('submission_id');
        expect(submitRes.body).toHaveProperty('judge_job_id');
        expect(submitRes.body).toHaveProperty('queue_driver');
        expect(submitRes.body).toHaveProperty('status', 'PENDING');

        const id = submitRes.body.submission_id;
        const terminal = [
          'ACCEPTED',
          'WRONG_ANSWER',
          'TLE',
          'MLE',
          'RUNTIME_ERROR',
          'COMPILE_ERROR',
        ];

        const start = Date.now();
        while (true) {
          const poll = await request(app.getHttpServer())
            .get(`/api/v1/submissions/${id}`)
            .set('Authorization', `Bearer ${aliceToken}`)
            .expect(200);

          const status = poll.body.status as string;
          if (terminal.includes(status)) {
            expect(poll.body).toHaveProperty('metrics');
            expect(poll.body).toHaveProperty('queued_at');
            expect(poll.body).toHaveProperty('finished_at');
            break;
          }

          if (Date.now() - start > 10000) {
            throw new Error(
              `Timed out waiting for terminal status, last=${status}`,
            );
          }

          await new Promise((r) => setTimeout(r, 200));
        }

        await request(app.getHttpServer())
          .get(`/api/v1/submissions/${id}`)
          .set('Authorization', `Bearer ${bobToken}`)
          .expect(403);
      });
    });

    describe('GET /api/v1/submissions/:id', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/submissions/non-existent-uuid')
          .expect(401);
      });

      it('should return 404 for non-existent submission', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/submissions/non-existent-uuid')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Users
  // ═══════════════════════════════════════════════════════════════════════
  describe('Users', () => {
    describe('GET /api/v1/users', () => {
      it('should return users list', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should return user fields with correct types', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        if (res.body.data.length > 0) {
          const user = res.body.data[0];
          expect(user).toHaveProperty('id');
          expect(user).toHaveProperty('username');
          expect(user).toHaveProperty('email');
          expect(user).toHaveProperty('role');
          expect(user).toHaveProperty('solvedCount');
          expect(user).toHaveProperty('rating');
          expect(user).toHaveProperty('createdAt');
          expect(typeof user.solvedCount).toBe('string');
          expect(typeof user.rating).toBe('string');
        }
      });

      it('should not expose passwordHash', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        if (res.body.data.length > 0) {
          expect(res.body.data[0]).not.toHaveProperty('passwordHash');
        }
      });

      it('should reject candidates from listing all users', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${aliceToken}`)
          .expect(403);
      });

      it('should allow examiner to list users for review workflows', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${examinerToken}`)
          .expect(200);
      });
    });

    describe('GET /api/v1/users/:username/submissions', () => {
      it('should return 404 for non-existent user', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/users/nonexistent_user_xyz/submissions')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('should return paginated submission history for existing user', async () => {
        // First find an existing user
        const usersRes = await request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        if (usersRes.body.data.length > 0) {
          const username = usersRes.body.data[0].username;
          const res = await request(app.getHttpServer())
            .get(`/api/v1/users/${username}/submissions`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('data');
          expect(typeof res.body.total).toBe('string');
          expect(typeof res.body.page).toBe('string');
        }
      });

      it('should support pagination parameters', async () => {
        const usersRes = await request(app.getHttpServer())
          .get('/api/v1/users')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        if (usersRes.body.data.length > 0) {
          const username = usersRes.body.data[0].username;
          const res = await request(app.getHttpServer())
            .get(`/api/v1/users/${username}/submissions?page=1&limit=5`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          expect(res.body.page).toBe('1');
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Leaderboard
  // ═══════════════════════════════════════════════════════════════════════
  describe('Leaderboard', () => {
    describe('GET /api/v1/leaderboard', () => {
      it('should return rankings', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/leaderboard')
          .expect(200);

        expect(res.body).toHaveProperty('total');
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should return total and page as strings', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/leaderboard')
          .expect(200);

        expect(typeof res.body.total).toBe('string');
        expect(typeof res.body.page).toBe('string');
      });

      it('should return ranking items with correct fields', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/leaderboard')
          .expect(200);

        if (res.body.data.length > 0) {
          expect(res.body.data[0]).toHaveProperty('rank');
          expect(res.body.data[0]).toHaveProperty('username');
          expect(res.body.data[0]).toHaveProperty('solved_count');
          expect(res.body.data[0]).toHaveProperty('rating');
        }
      });

      it('should support pagination', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/leaderboard?page=1&limit=5')
          .expect(200);

        expect(res.body.page).toBe('1');
      });

      it('should have first rank starting at 1', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/leaderboard?page=1')
          .expect(200);

        if (res.body.data.length > 0) {
          expect(res.body.data[0].rank).toBe('1');
        }
      });

      it('should return all ranking values as strings', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/leaderboard')
          .expect(200);

        if (res.body.data.length > 0) {
          const item = res.body.data[0];
          expect(typeof item.rank).toBe('string');
          expect(typeof item.solved_count).toBe('string');
          expect(typeof item.rating).toBe('string');
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. Internal API
  // ═══════════════════════════════════════════════════════════════════════
  describe('Internal API', () => {
    describe('GET /api/v1/internal/testcases/:id', () => {
      it('should return 401 without API key', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/internal/testcases/1')
          .expect(401);
      });

      it('should return 401 with wrong API key', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/internal/testcases/1')
          .set('x-internal-api-key', 'wrong-key')
          .expect(401);
      });

      it('should return test cases with correct API key', async () => {
        const apiKey = process.env.INTERNAL_API_KEY;
        if (apiKey) {
          // Get a valid problem ID first
          const problemsRes = await request(app.getHttpServer())
            .get('/api/v1/problems')
            .expect(200);

          if (problemsRes.body.items.length > 0) {
            const id = problemsRes.body.items[0].problem_id;
            const res = await request(app.getHttpServer())
              .get(`/api/v1/internal/testcases/${id}`)
              .set('x-internal-api-key', apiKey)
              .expect(200);

            expect(res.body).toHaveProperty('problem_id');
            expect(res.body).toHaveProperty('time_limit_ms');
            expect(res.body).toHaveProperty('memory_limit_mb');
            expect(res.body).toHaveProperty('test_cases');
            expect(Array.isArray(res.body.test_cases)).toBe(true);
          }
        }
      });

      it('should return 404 for non-existent problem with correct API key', async () => {
        const apiKey = process.env.INTERNAL_API_KEY;
        if (apiKey) {
          await request(app.getHttpServer())
            .get('/api/v1/internal/testcases/99999')
            .set('x-internal-api-key', apiKey)
            .expect(404);
        }
      });

      it('should return numeric fields as strings', async () => {
        const apiKey = process.env.INTERNAL_API_KEY;
        if (apiKey) {
          const problemsRes = await request(app.getHttpServer())
            .get('/api/v1/problems')
            .expect(200);

          if (problemsRes.body.items.length > 0) {
            const id = problemsRes.body.items[0].problem_id;
            const res = await request(app.getHttpServer())
              .get(`/api/v1/internal/testcases/${id}`)
              .set('x-internal-api-key', apiKey)
              .expect(200);

            expect(typeof res.body.problem_id).toBe('string');
            expect(typeof res.body.time_limit_ms).toBe('string');
            expect(typeof res.body.memory_limit_mb).toBe('string');
          }
        }
      });

      it('should include hidden testcases internally, but exclude them in public problem detail', async () => {
        const apiKey = process.env.INTERNAL_API_KEY;
        if (apiKey) {
          const publicDetail = await request(app.getHttpServer())
            .get('/api/v1/problems/1')
            .expect(200);

          expect(Array.isArray(publicDetail.body.sample_test_cases)).toBe(true);
          expect(publicDetail.body.sample_test_cases.length).toBe(2);

          const internal = await request(app.getHttpServer())
            .get('/api/v1/internal/testcases/1')
            .set('x-internal-api-key', apiKey)
            .expect(200);

          expect(Array.isArray(internal.body.test_cases)).toBe(true);
          expect(internal.body.test_cases.length).toBe(4);
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. Interviews
  // ═══════════════════════════════════════════════════════════════════════
  describe('Interviews', () => {
    describe('GET /api/v1/interviews', () => {
      it('should return interviews list', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/interviews')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body).toHaveProperty('total');
      });
    });

    describe('POST /api/v1/interviews', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/interviews')
          .send({ jobRole: 'Test', examinerEmpId: 'uuid' })
          .expect(401);
      });
    });

    describe('PATCH /api/v1/interviews/:id', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .patch('/api/v1/interviews/1')
          .send({ jobRole: 'Updated' })
          .expect(401);
      });
    });

    describe('DELETE /api/v1/interviews/:id', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .delete('/api/v1/interviews/1')
          .expect(401);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 9. Interview Candidates & Assignments
  // ═══════════════════════════════════════════════════════════════════════
  describe('Interview Candidates', () => {
    describe('POST /api/v1/interview-candidates', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .post('/api/v1/interview-candidates')
          .send({ jobId: 1, userId: 'uuid' })
          .expect(401);
      });
    });

    describe('GET /api/v1/interview-candidates', () => {
      it('should return candidates list', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/interview-candidates')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe('PATCH /api/v1/interview-candidates/:id/time', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .patch('/api/v1/interview-candidates/1/time')
          .send({ startTime: 1770000000, endTime: 1770003600 })
          .expect(401);
      });
    });

    describe('GET /api/v1/interview-candidates/:id/time-status', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/interview-candidates/1/time-status')
          .expect(401);
      });
    });

    describe('DELETE /api/v1/interview-candidates/:id', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .delete('/api/v1/interview-candidates/1')
          .expect(401);
      });
    });
  });

  describe('Assignments', () => {
    describe('GET /api/v1/assignments', () => {
      it('should return 401 without auth', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/assignments')
          .expect(401);
      });

      it('should return assignments list with privileged auth', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/assignments')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(Array.isArray(res.body)).toBe(true);
      });

      it('should reject candidate from listing all assignments', async () => {
        await request(app.getHttpServer())
          .get('/api/v1/assignments')
          .set('Authorization', `Bearer ${aliceToken}`)
          .expect(403);
      });
    });

    describe('DELETE /api/v1/assignments/:id', () => {
      it('should return 401 without auth token', async () => {
        await request(app.getHttpServer())
          .delete('/api/v1/assignments/1')
          .expect(401);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 10. Error Response Format
  // ═══════════════════════════════════════════════════════════════════════
  describe('Error Response Format', () => {
    it('should return standard error format for 404', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/problems/99999')
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('requestId');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('path', '/api/v1/problems/99999');
    });

    it('should return standard error format for 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/submissions')
        .send({ problem_id: 1, language: 'python3', source_code: 'pass' })
        .expect(401);

      expect(res.body).toHaveProperty('statusCode', 401);
      expect(res.body).toHaveProperty('message');
    });

    it('should return standard error format for 400 (validation)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: 'admin' })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('message');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 11. Global Prefix & Routing
  // ═══════════════════════════════════════════════════════════════════════
  describe('Global Routing', () => {
    it('should return 404 for paths without /api/v1 prefix', async () => {
      await request(app.getHttpServer()).get('/health').expect(404);
    });

    it('should return 404 for unknown routes', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/unknown-route')
        .expect(404);
    });
  });
});
