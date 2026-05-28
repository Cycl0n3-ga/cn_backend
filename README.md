# Backend Setup Guide

This is a NestJS backend using Prisma + PostgreSQL.

## Prerequisites

- Node.js 20.19+ (22.12+ or 24+ recommended; Prisma 7 requires this)
- npm
- PostgreSQL running locally (or a reachable Postgres instance)
- Docker Desktop running locally for sandboxed code judging

## 1) Install dependencies

```bash
npm install
```

## 2) Configure environment variables

```bash 
docker run --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres
```

Create a `.env` file in the `backend` folder:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
```

Update credentials, host, port, and database name to match your local setup.

## 3) Change database schema (recommended workflow)

When you change `prisma/schema.prisma`, use migrations (instead of only `db push`) so schema history is tracked and can be applied safely in other environments.

### Local development

1. Edit `prisma/schema.prisma`.
2. Create and apply a migration:

```bash
npx prisma migrate dev --name describe_change
```

This will:
- generate SQL under `prisma/migrations/*`
- apply the migration to your local database
- regenerate Prisma Client

### Staging / Production

After committing your migration files, apply them with:

```bash
npx prisma migrate deploy
```

### Quick reset for local-only testing

If you want to rebuild local tables from schema and wipe data:

```bash
npx prisma db push --force-reset
```

Use this reset flow for local testing only (not shared/prod migration workflow).

## 4) Seed with mock data

The seed script imports data from:

- `../online_code_test/src/data/mockDb.json`

Run:

```bash
npm run db:seed
```

## 5) Generate Prisma client (if needed)

If schema changed and types look stale:

```bash
npx prisma generate
```

## 6) Start the backend

```bash
# development
npm run start:dev

# production build/start
npm run build
npm run start:prod
```

## Code judge API

This backend supports a sandboxed judge flow:

1. A questioner creates a problem with one `testcase` and one `testcaseAns`.
2. An examiner/admin creates an assignment that connects an interview, candidate, and problem.
3. A candidate can run code against the public sample input.
4. A candidate submits code for the assignment.
5. The backend runs the submitted code inside a Docker container and stores the judge result.

The backend itself does not run inside Docker. Docker is only used to sandbox submitted code.

### Run vs Submit

```text
POST /judge/run
  Uses question.example / question.exampleAns.
  Does not create a submission record.
  Use this for the frontend Run button.

POST /submissions
  Uses question.testcase / question.testcaseAns.
  Creates a submission record with PENDING status.
  The judge queue runs it in the background and updates the result.
  Use this for the frontend Submit button.
```

### Supported languages

Currently supported:

```text
javascript
python
c
cpp
```

JavaScript submissions must export a `solve(input)` function:

```js
exports.solve = function solve(input) {
  const [a, b] = input.trim().split(/\s+/).map(Number);
  return String(a + b);
};
```

Python submissions must define a `solve(input)` function:

```py
def solve(input: str) -> str:
    a, b = map(int, input.strip().split())
    return str(a + b)
```

C submissions should be a complete program:

```c
#include <stdio.h>

int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d", a + b);
    return 0;
}
```

C++ submissions should be a complete program:

```cpp
#include <bits/stdc++.h>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b;
    return 0;
}
```

The judge compares stdout with the expected output after trimming whitespace and normalizing line endings.

### Judge statuses

```text
PENDING              Submission has been stored and is waiting for the judge queue.
RUNNING              Submission is currently being judged.
ACCEPTED             Output matches testcaseAns.
WRONG_ANSWER         Output does not match testcaseAns.
RUNTIME_ERROR        Submitted code crashed.
TIME_LIMIT_EXCEEDED  Submitted code ran longer than 5 seconds.
INTERNAL_ERROR       Docker is unavailable or the language is unsupported.
```

### Sandbox limits

The first version uses these Docker limits:

```text
Network: disabled
CPU: 0.5 CPU
Memory: 128 MB
Process limit: 64
Filesystem: read-only mounted submission files
Timeout: 5 seconds
Images: node:22-alpine, python:3.12-alpine, gcc:14
```

Judge jobs are processed by an in-memory queue so simultaneous submissions do not start unlimited Docker containers. The default concurrency is 2 jobs at a time. You can change it with:

```env
JUDGE_CONCURRENCY=2
```

### Frontend flow

The frontend should call these APIs in this order for a complete demo:

```text
POST /users/signup       Create candidate / examiner / questioner users.
POST /problems           Create a coding problem.
POST /interviews         Create an interview.
POST /assignments        Assign a problem to a candidate.
GET  /assignments/user/:userId
POST /judge/run          Run code against public sample input.
GET  /judge/queue        Inspect active and queued judge jobs.
POST /submissions        Submit code and receive a PENDING submission.
GET  /submissions/:id    Poll one submission until it is ACCEPTED / WRONG_ANSWER / error.
GET  /submissions/user/:userId
```

### Create a problem

```http
POST /problems
Content-Type: application/json
```

```json
{
  "title": "Two Sum Input",
  "prompt": "Read two numbers from input and return their sum.",
  "example": "1 2",
  "exampleAns": "3",
  "testcase": "40 2",
  "testcaseAns": "42",
  "authorUserId": 1
}
```

Response:

```json
{
  "id": 1,
  "title": "Two Sum Input",
  "prompt": "Read two numbers from input and return their sum.",
  "example": "1 2",
  "exampleAns": "3",
  "testcase": "40 2",
  "testcaseAns": "42",
  "authorUserId": 1
}
```

### Create an interview

```http
POST /interviews
Content-Type: application/json
```

```json
{
  "jobRole": "Backend Engineer",
  "examinerEmpId": "123456"
}
```

`examinerEmpId` must belong to an existing examiner/admin-style user with an `empId`.

### Create an assignment

```http
POST /assignments
Content-Type: application/json
```

```json
{
  "jobId": 1,
  "userId": 2,
  "questionId": 1
}
```

`userId` is the candidate user id.

### Get candidate assignments

```http
GET /assignments/user/2
```

Response:

```json
[
  {
    "id": 1,
    "jobId": 1,
    "userId": 2,
    "questionId": 1,
    "question": {
      "id": 1,
      "title": "Two Sum Input",
      "prompt": "Read two numbers from input and return their sum.",
      "example": "1 2",
      "exampleAns": "3",
      "testcase": "40 2",
      "testcaseAns": "42",
      "authorUserId": 1
    }
  }
]
```

### Run code against the public sample

```http
POST /judge/run
Content-Type: application/json
```

`questionId` is the problem id. This endpoint runs against `example` and `exampleAns`, and does not store a submission.

```json
{
  "questionId": 1,
  "language": "python",
  "code": "def solve(input: str) -> str:\n    a, b = map(int, input.strip().split())\n    return str(a + b)"
}
```

Response:

```json
{
  "status": "ACCEPTED",
  "stdout": "3",
  "stderr": "",
  "expectedOutput": "3",
  "score": 100,
  "executionTimeMs": 300
}
```

### Submit code

```http
POST /submissions
Content-Type: application/json
```

```json
{
  "assignmentId": 1,
  "userId": 2,
  "language": "cpp",
  "code": "#include <bits/stdc++.h>\nusing namespace std;\nint main() { int a, b; cin >> a >> b; cout << a + b; return 0; }"
}
```

Immediate response:

```json
{
  "id": 1,
  "assignmentId": 1,
  "userId": 2,
  "questionId": 1,
  "language": "cpp",
  "code": "#include <bits/stdc++.h>\nusing namespace std;\nint main() { int a, b; cin >> a >> b; cout << a + b; return 0; }",
  "status": "PENDING",
  "stdout": "",
  "stderr": "",
  "expectedOutput": "42",
  "score": 0,
  "executionTimeMs": null
}
```

Poll the submission result:

```http
GET /submissions/1
```

Finished response:

```json
{
  "id": 1,
  "status": "ACCEPTED",
  "stdout": "42",
  "stderr": "",
  "expectedOutput": "42",
  "score": 100,
  "executionTimeMs": 800
}
```

Wrong answer response:

```json
{
  "status": "WRONG_ANSWER",
  "stdout": "41",
  "expectedOutput": "42",
  "score": 0
}
```

### Local smoke test with curl

Start Docker Desktop first, then run:

```bash
docker ps
```

If Docker is running, the command should print a table instead of a daemon connection error.

Start the backend:

```bash
npm run start:dev
```

Use these sample calls after creating `.env`, running migrations, and ensuring the referenced ids exist:

```bash
curl -X POST http://localhost:4100/judge/run \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": 1,
    "language": "python",
    "code": "def solve(input: str) -> str:\n    a, b = map(int, input.strip().split())\n    return str(a + b)"
  }'
```

```bash
curl -X POST http://localhost:4100/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "assignmentId": 1,
    "userId": 2,
    "language": "c",
    "code": "#include <stdio.h>\nint main(void) { int a, b; scanf(\"%d %d\", &a, &b); printf(\"%d\", a + b); return 0; }"
  }'
```

If Docker is not running, the submission will return `INTERNAL_ERROR`.

## Database inspection

### Option A: Prisma Studio (UI)

```bash
npx prisma studio
```

### Option B: SQL via psql

```bash
psql "$DATABASE_URL"
```

Then run:

```sql
\dt
SELECT * FROM users;
SELECT * FROM interviews;
SELECT * FROM "interviewCandidates";
SELECT * FROM questions;
SELECT * FROM assignments;
```

## Useful scripts

- `npm run db:migrate` - run Prisma migration in dev mode
- `npm run db:seed` - seed database from mock JSON
- `npm run test` - unit tests
- `npm run test:e2e` - e2e tests
